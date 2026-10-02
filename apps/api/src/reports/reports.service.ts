import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { assertInterventionAccess, currentUser } from '../auth/auth.types.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ClientsService } from '../clients/clients.service.js';
import type { ReportStatus } from '../common/domain.js';
import { formatShortDateFr } from '../common/dates.js';
import { assertTransition, REPORT_TRANSITIONS } from '../common/state-machine.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PortalService } from '../portal/portal.module.js';
import { QuotesService } from '../quotes/quotes.service.js';
import { computeBilling } from './billing.js';
import { partsJson, readParts } from './parts.js';
import type { UpdateReportDto } from './reports.dto.js';

@Injectable()
export class ReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly catalog: CatalogService,
        private readonly clients: ClientsService,
        private readonly quotes: QuotesService,
        private readonly portal: PortalService,
    ) {}

    list() {
        return this.prisma.report.findMany({
            orderBy: { createdAt: 'desc' },
            include: { intervention: { include: { client: true, technician: true } }, quote: { select: { id: true, number: true, status: true } } },
        });
    }

    private async get(id: string) {
        const report = await this.prisma.report.findUnique({
            where: { id },
            include: {
                intervention: { include: { client: true, site: true, equipment: true, technician: true, attachments: { orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, filename: true, mimeType: true, size: true, caption: true, uploadedBy: true, createdAt: true } } } },
                quote: { select: { id: true, number: true, status: true } },
            },
        });
        if (!report) throw new NotFoundException('Rapport introuvable');
        return report;
    }

    async findOne(id: string) {
        const report = await this.get(id);
        assertInterventionAccess(currentUser(), report.intervention.technicianId);
        const [coverage, prices, timeline] = await Promise.all([
            this.clients.coverage(report.intervention.clientId, report.createdAt),
            this.catalog.priceMap(),
            this.activity.forEntities([id, report.interventionId]),
        ]);
        const parts = readParts(report.parts);
        return {
            ...report,
            parts,
            coverage,
            billing: computeBilling(parts, report.laborHours, coverage, prices),
            timeline,
        };
    }

    /** Correction manuelle du brouillon ; la facturation est recalculée. */
    async update(id: string, dto: UpdateReportDto) {
        const report = await this.get(id);
        if (report.status !== 'DRAFT') throw new ConflictException('Seul un rapport en brouillon peut être modifié');

        const parts = dto.parts?.map((p) => ({ label: p.label, catalogCode: p.catalogCode ?? null, quantity: p.quantity }))
            ?? readParts(report.parts);
        const laborHours = dto.laborHours ?? report.laborHours;
        const [coverage, prices] = await Promise.all([
            this.clients.coverage(report.intervention.clientId, report.createdAt),
            this.catalog.priceMap(),
        ]);
        const billing = computeBilling(parts, laborHours, coverage, prices);

        await this.prisma.report.update({
            where: { id },
            data: {
                reason: dto.reason,
                diagnosis: dto.diagnosis,
                workDone: dto.workDone,
                result: dto.result,
                recommendation: dto.recommendation,
                laborHours,
                parts: partsJson(parts),
                billable: billing.billable,
                billingNotes: billing.notes,
            },
        });
        await this.activity.log({ actor: 'USER', type: 'REPORT_EDITED', message: 'Rapport corrigé', entityType: 'REPORT', entityId: id });
        return this.findOne(id);
    }

    async validate(id: string) {
        const report = await this.get(id);
        assertTransition(REPORT_TRANSITIONS, report.status as ReportStatus, 'VALIDATED', 'Rapport');
        await this.prisma.report.update({ where: { id }, data: { status: 'VALIDATED', validatedAt: new Date() } });
        await this.activity.log({ actor: 'USER', type: 'REPORT_VALIDATED', message: 'Rapport validé', entityType: 'REPORT', entityId: id });
        return this.findOne(id);
    }

    async reopen(id: string) {
        const report = await this.get(id);
        assertTransition(REPORT_TRANSITIONS, report.status as ReportStatus, 'DRAFT', 'Rapport');
        await this.prisma.report.update({ where: { id }, data: { status: 'DRAFT', validatedAt: null } });
        return this.findOne(id);
    }

    /** Envoi au client : clôture l'intervention. */
    async send(id: string) {
        const report = await this.get(id);
        assertTransition(REPORT_TRANSITIONS, report.status as ReportStatus, 'SENT', 'Rapport (validez-le avant envoi)');
        const { intervention } = report;
        const portal = await this.portal.link(intervention.clientId);

        await this.prisma.$transaction(async (tx) => {
            await tx.report.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
            if (intervention.status === 'COMPLETED') {
                await tx.intervention.update({ where: { id: intervention.id }, data: { status: 'CLOSED', closedAt: new Date() } });
            }
            if (intervention.client.email) {
                await this.activity.sendMessage(
                    {
                        recipient: intervention.client.email,
                        subject: `Rapport d'intervention #${intervention.number}`,
                        attachments: [{ kind: 'REPORT_PDF', id }],
                        body: `Bonjour,\n\nVeuillez trouver ci-joint le rapport de l'intervention du ${formatShortDateFr(report.createdAt)}.\n\nDiagnostic : ${report.diagnosis}\nTravaux : ${report.workDone}\nRésultat : ${report.result}${report.recommendation ? `\nRecommandation : ${report.recommendation}` : ''}\n\nRetrouvez tous vos documents sur votre espace client :\n${portal}\n\nCordialement,\nL'équipe maintenance`,
                        entityType: 'REPORT',
                        entityId: id,
                    },
                    tx,
                );
            }
            await this.activity.log(
                { actor: 'USER', type: 'REPORT_SENT', message: `Rapport #${intervention.number} envoyé au client, intervention clôturée`, entityType: 'REPORT', entityId: id },
                tx,
            );
        });
        return this.findOne(id);
    }

    createQuote(id: string) {
        return this.quotes.createFromReport(id);
    }
}
