import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { AiService } from '../ai/ai.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ClientsService } from '../clients/clients.service.js';
import { addMinutes, atTime, formatDateFr, formatTimeFr } from '../common/dates.js';
import { nextValue } from '../common/numbering.js';
import { WORKDAY, type ActivityActor, type InterventionStatus } from '../common/domain.js';
import { partsJson, readParts } from '../reports/parts.js';
import { assertTransition, INTERVENTION_TRANSITIONS } from '../common/state-machine.js';
import { PlanningService } from '../planning/planning.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { computeBilling } from '../reports/billing.js';
import type {
    AssignInterventionDto,
    CreateInterventionDto,
    ListInterventionsQuery,
} from './interventions.dto.js';

const FIRST_NUMBER = 4581;

const detailInclude = {
    client: true,
    site: true,
    equipment: true,
    technician: true,
    request: { select: { id: true, subject: true, fromName: true, receivedAt: true } },
    report: true,
    quotes: { select: { id: true, number: true, status: true } },
} as const;

@Injectable()
export class InterventionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly planning: PlanningService,
        private readonly clients: ClientsService,
        private readonly ai: AiService,
        private readonly catalog: CatalogService,
    ) {}

    list(query: ListInterventionsQuery) {
        return this.prisma.intervention.findMany({
            where: { status: query.status, technicianId: query.technicianId, clientId: query.clientId },
            orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
            include: { client: true, site: true, technician: true },
        });
    }

    private async get(id: string, tx: Tx = this.prisma) {
        const intervention = await tx.intervention.findUnique({ where: { id }, include: detailInclude });
        if (!intervention) throw new NotFoundException('Intervention introuvable');
        return intervention;
    }

    async findOne(id: string) {
        const intervention = await this.get(id);
        const relatedIds = [id, intervention.report?.id, ...intervention.quotes.map((q) => q.id)].filter(
            (x): x is string => Boolean(x),
        );
        const [timeline, messages, coverage] = await Promise.all([
            this.activity.forEntities(relatedIds),
            this.activity.messagesFor(relatedIds),
            this.clients.coverage(intervention.clientId),
        ]);
        return {
            ...intervention,
            report: intervention.report ? { ...intervention.report, parts: readParts(intervention.report.parts) } : null,
            coverage,
            timeline,
            messages,
        };
    }

    async create(dto: CreateInterventionDto, actor: ActivityActor = 'USER', requestId?: string, tx: Tx = this.prisma) {
        const site = await tx.site.findUnique({ where: { id: dto.siteId }, include: { equipments: true } });
        if (!site || site.clientId !== dto.clientId) throw new BadRequestException('Site invalide pour ce client');
        if (dto.equipmentId && !site.equipments.some((e) => e.id === dto.equipmentId)) {
            throw new BadRequestException('Équipement invalide pour ce site');
        }

        const number = await nextValue(tx, 'intervention', FIRST_NUMBER);

        const intervention = await tx.intervention.create({
            data: {
                number,
                clientId: dto.clientId,
                siteId: dto.siteId,
                equipmentId: dto.equipmentId,
                title: dto.title,
                description: dto.description,
                type: dto.type ?? 'BREAKDOWN',
                priority: dto.priority ?? 'NORMAL',
                initialDiagnosis: dto.initialDiagnosis,
                estimatedMinutes: dto.estimatedMinutes ?? 90,
                requestId,
            },
        });

        await this.activity.log(
            {
                actor,
                type: 'INTERVENTION_CREATED',
                message: `Intervention #${number} créée${requestId ? ' depuis une demande entrante' : ''}`,
                entityType: 'INTERVENTION',
                entityId: intervention.id,
            },
            tx,
        );
        return intervention;
    }

    private async transition(id: string, to: InterventionStatus, tx: Tx = this.prisma) {
        const intervention = await this.get(id, tx);
        assertTransition(INTERVENTION_TRANSITIONS, intervention.status as InterventionStatus, to, `Intervention #${intervention.number}`);
        return intervention;
    }

    recommendations(id: string, fromDay?: Date) {
        return this.planning.recommend(id, fromDay);
    }

    async assign(id: string, dto: AssignInterventionDto) {
        return this.prisma.$transaction(async (tx) => {
            const intervention = await this.transition(id, 'SCHEDULED', tx);
            const technician = await tx.technician.findUnique({ where: { id: dto.technicianId } });
            if (!technician?.active) throw new BadRequestException('Technicien introuvable ou inactif');

            const start = new Date(dto.start);
            const duration = dto.durationMinutes ?? intervention.estimatedMinutes;
            const end = addMinutes(start, duration);
            if (start < atTime(start, WORKDAY.startHour) || end > atTime(start, WORKDAY.endHour)) {
                throw new BadRequestException(`Le créneau doit être compris entre ${WORKDAY.startHour}h et ${WORKDAY.endHour}h`);
            }
            if (start < addMinutes(new Date(), -5)) throw new BadRequestException('Impossible de planifier dans le passé');

            const free = await this.planning.assertSlotAvailable(technician.id, { start, end }, id, tx);
            if (!free) {
                throw new ConflictException(`${technician.firstName} n'est pas disponible sur ce créneau (conflit de planning)`);
            }

            const rescheduled = intervention.status !== 'TO_SCHEDULE';
            const updated = await tx.intervention.update({
                where: { id },
                data: {
                    technicianId: technician.id,
                    scheduledStart: start,
                    scheduledEnd: end,
                    estimatedMinutes: duration,
                    status: 'SCHEDULED',
                    dispatchedAt: null,
                },
            });

            await this.activity.log(
                {
                    actor: 'USER',
                    type: rescheduled ? 'INTERVENTION_RESCHEDULED' : 'INTERVENTION_SCHEDULED',
                    message: `${technician.firstName} ${technician.lastName} affecté ${formatDateFr(start)} à ${formatTimeFr(start)}`,
                    entityType: 'INTERVENTION',
                    entityId: id,
                },
                tx,
            );
            return updated;
        });
    }

    async unassign(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const intervention = await this.transition(id, 'TO_SCHEDULE', tx);
            await this.activity.log(
                {
                    actor: 'USER',
                    type: 'INTERVENTION_UNSCHEDULED',
                    message: `Affectation de ${intervention.technician?.firstName ?? 'technicien'} annulée`,
                    entityType: 'INTERVENTION',
                    entityId: id,
                },
                tx,
            );
            return tx.intervention.update({
                where: { id },
                data: { status: 'TO_SCHEDULE', technicianId: null, scheduledStart: null, scheduledEnd: null, dispatchedAt: null },
            });
        });
    }

    /** Envoie la mission au technicien et informe le client du créneau. */
    async dispatch(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const i = await this.transition(id, 'DISPATCHED', tx);
            const tech = i.technician!;
            const when = `${formatDateFr(i.scheduledStart!)} à ${formatTimeFr(i.scheduledStart!)}`;

            await this.activity.sendMessage(
                {
                    channel: 'PUSH',
                    recipient: tech.email,
                    subject: `Mission #${i.number} — ${i.client.name}`,
                    body: `${when} · ${i.site.address}, ${i.site.city}\n${i.title}\n${i.description}`,
                    entityType: 'INTERVENTION',
                    entityId: id,
                },
                tx,
            );
            if (i.client.email) {
                await this.activity.sendMessage(
                    {
                        recipient: i.client.email,
                        subject: `Confirmation d'intervention #${i.number}`,
                        body: `Bonjour,\n\nNous vous confirmons le passage de ${tech.firstName} ${when} pour : ${i.title}.\n\nCordialement,\nL'équipe maintenance`,
                        entityType: 'INTERVENTION',
                        entityId: id,
                    },
                    tx,
                );
            }
            await this.activity.log(
                {
                    actor: 'USER',
                    type: 'MISSION_DISPATCHED',
                    message: `Mission envoyée à ${tech.firstName}${i.client.email ? ', client informé par email' : ''}`,
                    entityType: 'INTERVENTION',
                    entityId: id,
                },
                tx,
            );
            return tx.intervention.update({ where: { id }, data: { status: 'DISPATCHED', dispatchedAt: new Date() } });
        });
    }

    async start(id: string) {
        const i = await this.transition(id, 'IN_PROGRESS');
        await this.activity.log({
            actor: 'TECHNICIAN',
            type: 'INTERVENTION_STARTED',
            message: `${i.technician?.firstName ?? 'Le technicien'} est arrivé sur site`,
            entityType: 'INTERVENTION',
            entityId: id,
        });
        return this.prisma.intervention.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    }

    /** Compte rendu du technicien → rapport brouillon généré par l'IA + détection de facturation. */
    async submitReport(id: string, voiceNote: string) {
        let intervention = await this.get(id);
        if (intervention.status === 'DISPATCHED') {
            await this.start(id);
            intervention = await this.get(id);
        }
        assertTransition(INTERVENTION_TRANSITIONS, intervention.status as InterventionStatus, 'COMPLETED', `Intervention #${intervention.number}`);

        const [catalog, prices, coverage] = await Promise.all([
            this.catalog.forAi(),
            this.catalog.priceMap(),
            this.clients.coverage(intervention.clientId),
        ]);

        const { data: draft, provider } = await this.ai.draftReport({
            interventionTitle: intervention.title,
            problem: intervention.description,
            equipmentLabel: intervention.equipment?.label ?? null,
            voiceNote,
            catalog,
        });
        const billing = computeBilling(draft.parts, draft.laborHours, coverage, prices);

        return this.prisma.$transaction(async (tx) => {
            const report = await tx.report.create({
                data: {
                    interventionId: id,
                    voiceNote,
                    reason: draft.reason,
                    diagnosis: draft.diagnosis,
                    workDone: draft.workDone,
                    result: draft.result,
                    recommendation: draft.recommendation,
                    parts: partsJson(draft.parts),
                    laborHours: draft.laborHours,
                    billable: billing.billable,
                    billingNotes: billing.notes,
                    aiProvider: provider,
                },
            });
            await tx.intervention.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
            await this.activity.log(
                {
                    actor: 'AI',
                    type: 'REPORT_DRAFTED',
                    message: `Rapport généré à partir du compte rendu vocal${billing.billable ? ' — prestation facturable détectée' : ''}`,
                    entityType: 'REPORT',
                    entityId: report.id,
                },
                tx,
            );
            return report;
        });
    }

    async cancel(id: string, reason: string) {
        return this.prisma.$transaction(async (tx) => {
            const i = await this.transition(id, 'CANCELLED', tx);
            await this.activity.log(
                { actor: 'USER', type: 'INTERVENTION_CANCELLED', message: `Intervention #${i.number} annulée : ${reason}`, entityType: 'INTERVENTION', entityId: id },
                tx,
            );
            return tx.intervention.update({ where: { id }, data: { status: 'CANCELLED', cancelledReason: reason } });
        });
    }
}
