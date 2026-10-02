import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { AiService } from '../ai/ai.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ClientsService } from '../clients/clients.service.js';
import { zonedParts } from '../common/dates.js';
import type { QuoteStatus } from '../common/domain.js';
import { nextValue } from '../common/numbering.js';
import { assertTransition, QUOTE_TRANSITIONS } from '../common/state-machine.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { computeBilling, quoteTotals, type BillableLine } from '../reports/billing.js';
import { readParts } from '../reports/parts.js';
import type { ListQuotesQuery, UpdateQuoteDto } from './quotes.dto.js';

const FIRST_QUOTE_SEQUENCE = 91;

const include = {
    client: true,
    lines: { orderBy: { position: 'asc' } },
    intervention: { select: { id: true, number: true, title: true } },
    report: { select: { id: true } },
    request: { select: { id: true, subject: true } },
} as const;

type QuoteLike = { vatRate: number; lines: { quantity: number; unitPriceCents: number }[] };

function present<T extends QuoteLike>(quote: T) {
    return { ...quote, ...quoteTotals(quote.lines, quote.vatRate) };
}

@Injectable()
export class QuotesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly ai: AiService,
        private readonly catalog: CatalogService,
        private readonly clients: ClientsService,
    ) {}

    async list(query: ListQuotesQuery) {
        const quotes = await this.prisma.quote.findMany({
            where: { status: query.status },
            orderBy: { createdAt: 'desc' },
            include,
        });
        return quotes.map(present);
    }

    private async get(id: string, tx: Tx = this.prisma) {
        const quote = await tx.quote.findUnique({ where: { id }, include });
        if (!quote) throw new NotFoundException('Devis introuvable');
        return quote;
    }

    async findOne(id: string) {
        const quote = await this.get(id);
        const [timeline, messages] = await Promise.all([this.activity.forEntities([id]), this.activity.messagesFor([id])]);
        return { ...present(quote), timeline, messages };
    }

    /** D-2026-091 : numérotation annuelle, sans doublon. */
    private async nextNumber(tx: Tx) {
        const { year } = zonedParts(new Date());
        const seq = await nextValue(tx, `quote:${year}`, FIRST_QUOTE_SEQUENCE);
        return `D-${year}-${String(seq).padStart(3, '0')}`;
    }

    private async createDraft(
        tx: Tx,
        data: {
            clientId: string;
            title: string;
            lines: BillableLine[];
            warnings: string[];
            notes?: string;
            interventionId?: string;
            reportId?: string;
            requestId?: string;
        },
        source: string,
    ) {
        const quote = await tx.quote.create({
            data: {
                number: await this.nextNumber(tx),
                clientId: data.clientId,
                title: data.title,
                notes: data.notes,
                warnings: data.warnings,
                interventionId: data.interventionId,
                reportId: data.reportId,
                requestId: data.requestId,
                lines: { create: data.lines.map((line, position) => ({ ...line, position })) },
            },
        });
        await this.activity.log(
            {
                actor: 'AI',
                type: 'QUOTE_DRAFTED',
                message: `Brouillon de devis ${quote.number} généré ${source} — en attente de validation`,
                entityType: 'QUOTE',
                entityId: quote.id,
            },
            tx,
        );
        return quote;
    }

    /** Devis à partir d'un rapport : reprend les éléments hors contrat. */
    async createFromReport(reportId: string) {
        const report = await this.prisma.report.findUnique({
            where: { id: reportId },
            include: { intervention: true, quote: true },
        });
        if (!report) throw new NotFoundException('Rapport introuvable');
        if (report.quote) throw new ConflictException(`Un devis existe déjà pour ce rapport (${report.quote.number})`);
        if (!report.billable) throw new BadRequestException('Ce rapport ne contient aucun élément facturable');

        const [prices, coverage] = await Promise.all([
            this.catalog.priceMap(),
            this.clients.coverage(report.intervention.clientId),
        ]);
        const billing = computeBilling(readParts(report.parts), report.laborHours, coverage, prices);

        const quote = await this.prisma.$transaction((tx) =>
            this.createDraft(
                tx,
                {
                    clientId: report.intervention.clientId,
                    title: `${report.intervention.title} — suite intervention #${report.intervention.number}`,
                    lines: billing.lines,
                    warnings: billing.warnings,
                    notes: billing.notes,
                    interventionId: report.interventionId,
                    reportId: report.id,
                },
                `depuis le rapport #${report.intervention.number}`,
            ),
        );
        return this.findOne(quote.id);
    }

    /** Devis à partir d'une demande de chiffrage : lignes proposées par l'IA, prix du catalogue. */
    async createFromRequest(requestId: string) {
        const request = await this.prisma.inboundRequest.findUnique({ where: { id: requestId }, include: { quote: true } });
        if (!request) throw new NotFoundException('Demande introuvable');
        if (request.quote) throw new ConflictException(`Un devis existe déjà pour cette demande (${request.quote.number})`);
        if (!request.clientId) throw new BadRequestException("Rattachez d'abord la demande à un client");

        const [catalog, prices] = await Promise.all([this.catalog.forAi(), this.catalog.priceMap()]);
        const { data: suggestion, provider } = await this.ai.suggestQuote({
            subject: request.subject,
            body: request.body,
            catalog,
        });

        const warnings = [...suggestion.warnings];
        const lines: BillableLine[] = suggestion.lines.map((line) => {
            const item = line.catalogCode ? prices.get(line.catalogCode) : undefined;
            if (!item) warnings.push(`Prix à renseigner : « ${line.label} ».`);
            return {
                kind: line.kind,
                label: item?.label ?? line.label,
                quantity: line.quantity,
                unitPriceCents: item?.unitPriceCents ?? 0,
                catalogCode: item ? line.catalogCode : null,
            };
        });

        const quote = await this.prisma.$transaction(async (tx) => {
            const created = await this.createDraft(
                tx,
                { clientId: request.clientId!, title: suggestion.title, lines, warnings, requestId: request.id },
                `depuis la demande « ${request.subject} » (${provider})`,
            );
            await tx.inboundRequest.update({ where: { id: request.id }, data: { status: 'CONVERTED' } });
            return created;
        });
        return this.findOne(quote.id);
    }

    async update(id: string, dto: UpdateQuoteDto) {
        const quote = await this.get(id);
        if (quote.status !== 'DRAFT') throw new ConflictException('Seul un devis en brouillon peut être modifié');

        await this.prisma.$transaction(async (tx) => {
            if (dto.lines) {
                await tx.quoteLine.deleteMany({ where: { quoteId: id } });
                await tx.quoteLine.createMany({
                    data: dto.lines.map((l, position) => ({ ...l, catalogCode: l.catalogCode ?? null, quoteId: id, position })),
                });
            }
            await tx.quote.update({
                where: { id },
                data: { title: dto.title, notes: dto.notes, vatRate: dto.vatRate },
            });
            await this.activity.log(
                { actor: 'USER', type: 'QUOTE_EDITED', message: `Devis ${quote.number} modifié`, entityType: 'QUOTE', entityId: id },
                tx,
            );
        });
        return this.findOne(id);
    }

    private async move(id: string, to: QuoteStatus, message: (n: string) => string, extra: object = {}) {
        const quote = await this.get(id);
        assertTransition(QUOTE_TRANSITIONS, quote.status as QuoteStatus, to, `Devis ${quote.number}`);
        if (to === 'VALIDATED') {
            if (!quote.lines.length) throw new BadRequestException('Le devis ne contient aucune ligne');
            if (quote.lines.some((l) => l.unitPriceCents === 0)) {
                throw new BadRequestException('Certaines lignes ont un prix à 0 € : complétez-les avant validation');
            }
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.quote.update({ where: { id }, data: { status: to, ...extra } });
            await this.activity.log(
                { actor: 'USER', type: `QUOTE_${to}`, message: message(quote.number), entityType: 'QUOTE', entityId: id },
                tx,
            );
            if (to === 'SENT' && quote.client.email) {
                const { totalTtcCents } = quoteTotals(quote.lines, quote.vatRate);
                await this.activity.sendMessage(
                    {
                        recipient: quote.client.email,
                        subject: `Devis ${quote.number} — ${quote.title}`,
                        attachments: [{ kind: 'QUOTE_PDF', id }],
                        body: `Bonjour,\n\nVeuillez trouver ci-joint notre devis ${quote.number} d'un montant de ${(totalTtcCents / 100).toFixed(2).replace('.', ',')} € TTC.\n\nCordialement,\nL'équipe maintenance`,
                        entityType: 'QUOTE',
                        entityId: id,
                    },
                    tx,
                );
            }
        });
        return this.findOne(id);
    }

    validate(id: string) {
        return this.move(id, 'VALIDATED', (n) => `Devis ${n} validé`, { validatedAt: new Date() });
    }

    reopen(id: string) {
        return this.move(id, 'DRAFT', (n) => `Devis ${n} repassé en brouillon`, { validatedAt: null });
    }

    send(id: string) {
        return this.move(id, 'SENT', (n) => `Devis ${n} envoyé au client`, { sentAt: new Date() });
    }

    accept(id: string) {
        return this.move(id, 'ACCEPTED', (n) => `Devis ${n} accepté par le client`, { decidedAt: new Date() });
    }

    refuse(id: string) {
        return this.move(id, 'REFUSED', (n) => `Devis ${n} refusé par le client`, { decidedAt: new Date() });
    }
}
