import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { AiService } from '../ai/ai.service.js';
import { ClientsService } from '../clients/clients.service.js';
import type { InterventionType, Priority, RequestCategory } from '../common/domain.js';
import { InterventionsService } from '../interventions/interventions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QuotesService } from '../quotes/quotes.service.js';
import type { ConvertRequestDto, IngestRequestDto, ListRequestsQuery, UpdateRequestDto } from './requests.dto.js';

const include = {
    client: { include: { sites: { include: { equipments: true } } } },
    site: true,
    equipment: true,
    intervention: { select: { id: true, number: true, status: true } },
    quote: { select: { id: true, number: true, status: true } },
} as const;

const CATEGORY_TO_TYPE: Record<RequestCategory, InterventionType> = {
    BREAKDOWN: 'BREAKDOWN',
    MAINTENANCE: 'MAINTENANCE',
    QUOTE_REQUEST: 'INSTALLATION',
    OTHER: 'AFTER_SALES',
};

// Durée estimée par défaut selon la priorité/type
const DEFAULT_MINUTES: Record<InterventionType, number> = {
    BREAKDOWN: 90,
    MAINTENANCE: 120,
    INSTALLATION: 240,
    AFTER_SALES: 60,
};

/** "RE: Urgent — Clim en panne" → "Clim en panne" */
export const cleanSubject = (subject: string) =>
    subject
        .replace(/^((re|tr|fwd?)\s*:\s*)+/i, '')
        .replace(/^(urgent|urgence|important)\s*[—–:-]\s*/i, '')
        .replace(/^./, (c) => c.toUpperCase());

const CATEGORY_LABEL: Record<RequestCategory, string> = {
    BREAKDOWN: 'panne',
    QUOTE_REQUEST: 'demande de devis',
    MAINTENANCE: 'entretien',
    OTHER: 'autre',
};
const PRIORITY_LABEL: Record<Priority, string> = { LOW: 'basse', NORMAL: 'normale', HIGH: 'haute', URGENT: 'urgente' };
const MATCH_LABEL = { email: 'email connu', domain: 'domaine email', name: 'nom cité' } as const;

@Injectable()
export class RequestsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly ai: AiService,
        private readonly clients: ClientsService,
        private readonly interventions: InterventionsService,
        private readonly quotes: QuotesService,
    ) {}

    async list(query: ListRequestsQuery) {
        return this.prisma.inboundRequest.findMany({
            where: query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } },
            orderBy: [{ receivedAt: 'desc' }],
            include: { client: true, intervention: { select: { id: true, number: true } }, quote: { select: { id: true, number: true } } },
        });
    }

    private async get(id: string) {
        const request = await this.prisma.inboundRequest.findUnique({ where: { id }, include });
        if (!request) throw new NotFoundException('Demande introuvable');
        return request;
    }

    async findOne(id: string) {
        const request = await this.get(id);
        const coverage = request.clientId ? await this.clients.coverage(request.clientId) : null;
        return { ...request, coverage };
    }

    /** Réception d'une demande (email, formulaire…) : elle est analysée immédiatement. */
    async ingest(dto: IngestRequestDto) {
        const request = await this.prisma.inboundRequest.create({
            data: { ...dto, channel: dto.channel ?? 'EMAIL' },
        });
        await this.activity.log({
            actor: 'SYSTEM',
            type: 'REQUEST_RECEIVED',
            message: `Demande reçue de ${dto.fromName} : « ${dto.subject} »`,
            entityType: 'REQUEST',
            entityId: request.id,
        });
        return this.analyze(request.id);
    }

    /** Analyse IA + rattachement déterministe au client, au site et à l'équipement. */
    async analyze(id: string) {
        const request = await this.get(id);
        if (request.status === 'CONVERTED') throw new ConflictException('Demande déjà traitée');

        const { data: analysis, provider } = await this.ai.analyzeRequest({
            subject: request.subject,
            body: request.body,
            fromName: request.fromName,
            fromEmail: request.fromEmail,
        });

        const match = await this.clients.matchSender(request.fromEmail, `${request.subject}\n${request.body}\n${request.fromName}`);
        const sites = match?.client.sites ?? [];
        const equipments = sites.flatMap((s) => s.equipments.map((e) => ({ ...e, siteId: s.id })));
        const equipment = analysis.equipmentType
            ? equipments.find((e) => e.type === analysis.equipmentType)
            : equipments.length === 1 ? equipments[0] : undefined;
        const siteId = equipment?.siteId ?? (sites.length === 1 ? sites[0].id : null);

        await this.prisma.inboundRequest.update({
            where: { id },
            data: {
                status: 'ANALYZED',
                category: analysis.category,
                priority: analysis.priority,
                summary: analysis.summary,
                symptoms: analysis.symptoms,
                suggestedAction: analysis.suggestedAction,
                confidence: analysis.confidence,
                aiProvider: provider,
                analyzedAt: new Date(),
                clientId: match?.client.id ?? null,
                siteId,
                equipmentId: equipment?.id ?? null,
            },
        });

        const matched = match ? ` · client reconnu : ${match.client.name} (${MATCH_LABEL[match.method]})` : ' · client non identifié';
        await this.activity.log({
            actor: 'AI',
            type: 'REQUEST_ANALYZED',
            message: `Demande qualifiée : ${CATEGORY_LABEL[analysis.category]}, priorité ${PRIORITY_LABEL[analysis.priority]}${matched}`,
            entityType: 'REQUEST',
            entityId: id,
        });
        return this.findOne(id);
    }

    async update(id: string, dto: UpdateRequestDto) {
        const request = await this.get(id);
        if (request.status === 'CONVERTED') throw new ConflictException('Demande déjà convertie');

        const clientId = dto.clientId ?? request.clientId;
        if (clientId && (dto.siteId || dto.equipmentId)) {
            const site = dto.siteId ? await this.prisma.site.findUnique({ where: { id: dto.siteId } }) : null;
            if (dto.siteId && site?.clientId !== clientId) throw new BadRequestException('Site invalide pour ce client');
        }

        await this.prisma.inboundRequest.update({
            where: { id },
            data: {
                category: dto.category,
                priority: dto.priority,
                clientId: dto.clientId,
                // Changer de client réinitialise site/équipement s'ils ne sont pas fournis
                siteId: dto.siteId ?? (dto.clientId && dto.clientId !== request.clientId ? null : undefined),
                equipmentId: dto.equipmentId ?? (dto.clientId && dto.clientId !== request.clientId ? null : undefined),
            },
        });
        await this.activity.log({ actor: 'USER', type: 'REQUEST_CORRECTED', message: 'Analyse corrigée manuellement', entityType: 'REQUEST', entityId: id });
        return this.findOne(id);
    }

    async convertToIntervention(id: string, dto: ConvertRequestDto) {
        const request = await this.get(id);
        if (request.intervention) throw new ConflictException(`Déjà convertie en intervention #${request.intervention.number}`);
        if (!request.clientId || !request.siteId) {
            throw new BadRequestException('Rattachez la demande à un client et un site avant de créer l’intervention');
        }

        const category = (request.category as RequestCategory | null) ?? 'BREAKDOWN';
        const type = dto.type ?? CATEGORY_TO_TYPE[category];
        const symptoms = request.symptoms;

        const intervention = await this.prisma.$transaction(async (tx) => {
            const created = await this.interventions.create(
                {
                    clientId: request.clientId!,
                    siteId: request.siteId!,
                    equipmentId: request.equipmentId ?? undefined,
                    title: dto.title ?? cleanSubject(request.subject),
                    description: dto.description ?? (symptoms.length ? symptoms.join(' + ') : request.summary ?? request.subject),
                    type,
                    priority: dto.priority ?? (request.priority as Priority | null) ?? 'NORMAL',
                    estimatedMinutes: dto.estimatedMinutes ?? DEFAULT_MINUTES[type],
                    initialDiagnosis: request.equipment
                        ? `Contrôler ${request.equipment.label.toLowerCase()} : ${symptoms.join(', ').toLowerCase() || 'symptômes à préciser'}.`
                        : undefined,
                },
                'USER',
                request.id,
                tx,
            );
            await tx.inboundRequest.update({ where: { id }, data: { status: 'CONVERTED' } });
            return created;
        });
        return intervention;
    }

    createQuote(id: string) {
        return this.quotes.createFromRequest(id);
    }

    async archive(id: string) {
        await this.get(id);
        await this.prisma.inboundRequest.update({ where: { id }, data: { status: 'ARCHIVED' } });
        await this.activity.log({ actor: 'USER', type: 'REQUEST_ARCHIVED', message: 'Demande archivée', entityType: 'REQUEST', entityId: id });
        return this.findOne(id);
    }
}
