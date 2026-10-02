// Contrat de l'API : forme des réponses JSON (dates en ISO 8601).
// - apps/web dérive ses types de ces schémas (z.infer)
// - apps/api vérifie ses réponses réelles contre eux dans les tests e2e
// Les objets acceptent des champs supplémentaires : seul ce qui est décrit ici est garanti.
import { z } from 'zod';
import * as D from './domain.js';

const date = z.iso.datetime({ offset: true });
const id = z.string().min(1);

// ─── Référentiels ────────────────────────────────────────────────

export const Equipment = z.object({
    id,
    siteId: id,
    type: z.enum(D.EQUIPMENT_TYPES),
    label: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
});

export const Site = z.object({
    id,
    clientId: id,
    label: z.string(),
    address: z.string(),
    postalCode: z.string(),
    city: z.string(),
    lat: z.number(),
    lng: z.number(),
});
export const SiteWithEquipments = Site.extend({ equipments: z.array(Equipment) });

export const Contract = z.object({
    id,
    reference: z.string(),
    label: z.string(),
    startDate: date,
    endDate: date,
    coversLabor: z.boolean(),
    coversParts: z.boolean(),
    coversTravel: z.boolean(),
    nextServiceDate: date.nullable(),
});

export const Client = z.object({
    id,
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    contactName: z.string().nullable(),
});

export const ClientSummary = Client.extend({
    siteCount: z.number().int(),
    interventionCount: z.number().int(),
    equipmentCount: z.number().int(),
    activeContract: z.boolean(),
    lastIntervention: z.object({ createdAt: date, number: z.number().int() }).nullable(),
});

export const Coverage = z.object({
    active: z.boolean(),
    reference: z.string().nullable(),
    coversLabor: z.boolean(),
    coversParts: z.boolean(),
    coversTravel: z.boolean(),
});

export const Technician = z.object({
    id,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    skills: z.array(z.enum(D.EQUIPMENT_TYPES)),
    baseLat: z.number(),
    baseLng: z.number(),
    active: z.boolean(),
});

export const CatalogItem = z.object({
    id,
    code: z.string(),
    kind: z.enum(D.QUOTE_LINE_KINDS),
    label: z.string(),
    unitPriceCents: z.number().int(),
    keywords: z.array(z.string()),
});

// ─── Traçabilité ─────────────────────────────────────────────────

export const Activity = z.object({
    id,
    createdAt: date,
    actor: z.enum(D.ACTIVITY_ACTORS),
    type: z.string(),
    message: z.string(),
    entityType: z.string(),
    entityId: z.string(),
});

export const OutboundMessage = z.object({
    id,
    createdAt: date,
    channel: z.enum(D.MESSAGE_CHANNELS),
    recipient: z.string(),
    subject: z.string(),
    body: z.string(),
    status: z.enum(D.MESSAGE_STATUSES),
    attempts: z.number().int(),
    lastError: z.string().nullable(),
    transport: z.string().nullable(),
    sentAt: date.nullable(),
});

export const MessageLog = z.object({
    transports: z.object({ email: z.string(), sms: z.string() }),
    counts: z.record(z.string(), z.number().int()),
    messages: z.array(OutboundMessage.extend({ entityType: z.string(), entityId: z.string() })),
});

export const Attachment = z.object({
    id,
    kind: z.enum(D.ATTACHMENT_KINDS),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int(),
    caption: z.string().nullable(),
    uploadedBy: z.string().nullable(),
    createdAt: date,
});

export const Capabilities = z.object({ transcription: z.boolean() });

// ─── Interventions ───────────────────────────────────────────────

const InterventionBase = z.object({
    id,
    number: z.number().int(),
    type: z.enum(D.INTERVENTION_TYPES),
    priority: z.enum(D.PRIORITIES),
    status: z.enum(D.INTERVENTION_STATUSES),
    title: z.string(),
    description: z.string(),
    initialDiagnosis: z.string().nullable(),
    estimatedMinutes: z.number().int(),
    scheduledStart: date.nullable(),
    scheduledEnd: date.nullable(),
    dispatchedAt: date.nullable(),
    startedAt: date.nullable(),
    completedAt: date.nullable(),
    closedAt: date.nullable(),
    cancelledReason: z.string().nullable(),
    signedBy: z.string().nullable(),
    signedAt: date.nullable(),
    createdAt: date,
    clientId: id,
    siteId: id,
    equipmentId: z.string().nullable(),
    technicianId: z.string().nullable(),
});

export const Intervention = InterventionBase.extend({
    client: Client,
    site: Site,
    technician: Technician.nullable(),
});

const Ref = <T extends z.ZodRawShape>(shape: T) => z.object({ id, ...shape });

export const ReportPart = z.object({
    label: z.string(),
    catalogCode: z.string().nullable(),
    quantity: z.number(),
});

export const Report = z.object({
    id,
    interventionId: id,
    status: z.enum(D.REPORT_STATUSES),
    voiceNote: z.string(),
    reason: z.string(),
    diagnosis: z.string(),
    workDone: z.string(),
    result: z.string(),
    recommendation: z.string().nullable(),
    parts: z.array(ReportPart),
    laborHours: z.number(),
    billable: z.boolean(),
    billingNotes: z.string().nullable(),
    aiProvider: z.string(),
    createdAt: date,
    validatedAt: date.nullable(),
    sentAt: date.nullable(),
});

export const InterventionDetail = Intervention.extend({
    equipment: Equipment.nullable(),
    request: Ref({ subject: z.string(), fromName: z.string(), receivedAt: date }).nullable(),
    report: Report.nullable(),
    quotes: z.array(Ref({ number: z.string(), status: z.enum(D.QUOTE_STATUSES) })),
    coverage: Coverage,
    timeline: z.array(Activity),
    messages: z.array(OutboundMessage),
    attachments: z.array(Attachment),
});

export const Mission = InterventionBase.extend({
    client: Client,
    site: Site,
    equipment: Equipment.nullable(),
    report: Ref({ status: z.enum(D.REPORT_STATUSES) }).nullable(),
    attachments: z.array(Attachment),
});

export const TechnicianWithLoad = Technician.extend({
    today: z.array(
        InterventionBase.pick({ id: true, number: true, title: true, status: true, scheduledStart: true, scheduledEnd: true }),
    ),
    plannedMinutes: z.number(),
});

export const TechnicianDetail = Technician.extend({ missions: z.array(Mission) });

export const Reason = z.object({ label: z.string(), detail: z.string(), positive: z.boolean() });

export const Recommendation = z.object({
    technicianId: id,
    technicianName: z.string(),
    score: z.number(),
    slot: z.object({ start: date, end: date }).nullable(),
    distanceKm: z.number(),
    travelMinutes: z.number(),
    skillMatch: z.boolean(),
    reasons: z.array(Reason),
});

export const PlanningDay = z.object({
    date,
    technicians: z.array(Technician.extend({ interventions: z.array(InterventionBase.extend({ client: Client, site: Site })) })),
    unscheduled: z.array(InterventionBase.extend({ client: Client, site: Site })),
});

// ─── Demandes entrantes ──────────────────────────────────────────

export const InboundRequest = z.object({
    id,
    channel: z.enum(D.REQUEST_CHANNELS),
    fromName: z.string(),
    fromEmail: z.string(),
    subject: z.string(),
    body: z.string(),
    receivedAt: date,
    status: z.enum(D.REQUEST_STATUSES),
    attachments: z.number().int(),
    category: z.enum(D.REQUEST_CATEGORIES).nullable(),
    priority: z.enum(D.PRIORITIES).nullable(),
    summary: z.string().nullable(),
    symptoms: z.array(z.string()),
    suggestedAction: z.enum(D.SUGGESTED_ACTIONS).nullable(),
    confidence: z.number().nullable(),
    aiProvider: z.string().nullable(),
    extractedPhone: z.string().nullable(),
    extractedAddress: z.string().nullable(),
    clientId: z.string().nullable(),
    siteId: z.string().nullable(),
    equipmentId: z.string().nullable(),
    client: Client.nullable(),
    intervention: Ref({ number: z.number().int() }).nullable(),
    quote: Ref({ number: z.string() }).nullable(),
});

export const InboundRequestDetail = InboundRequest.extend({
    client: Client.extend({ sites: z.array(SiteWithEquipments) }).nullable(),
    site: Site.nullable(),
    equipment: Equipment.nullable(),
    intervention: Ref({ number: z.number().int(), status: z.enum(D.INTERVENTION_STATUSES) }).nullable(),
    quote: Ref({ number: z.string(), status: z.enum(D.QUOTE_STATUSES) }).nullable(),
    coverage: Coverage.nullable(),
    /** Réponses déjà envoyées à l'expéditeur */
    replies: z.array(OutboundMessage),
});

export const ReplyDraft = z.object({
    subject: z.string(),
    body: z.string(),
    provider: z.string(),
    facts: z.array(z.string()),
});

export const TemporaryPassword = z.object({ temporaryPassword: z.string().min(8) });

// ─── Rapports & devis ────────────────────────────────────────────

export const BillableLine = z.object({
    kind: z.enum(D.QUOTE_LINE_KINDS),
    label: z.string(),
    quantity: z.number(),
    unitPriceCents: z.number().int(),
    catalogCode: z.string().nullable(),
});

const QuoteRef = Ref({ number: z.string(), status: z.enum(D.QUOTE_STATUSES) });

export const ReportDetail = Report.extend({
    intervention: Intervention.extend({ equipment: Equipment.nullable(), attachments: z.array(Attachment) }),
    quote: QuoteRef.nullable(),
    coverage: Coverage,
    billing: z.object({
        billable: z.boolean(),
        lines: z.array(BillableLine),
        notes: z.string(),
        warnings: z.array(z.string()),
    }),
    timeline: z.array(Activity),
});

export const ReportSummary = Report.extend({
    intervention: InterventionBase.extend({ client: Client, technician: Technician.nullable() }),
    quote: QuoteRef.nullable(),
});

export const QuoteLine = z.object({
    id,
    position: z.number().int(),
    kind: z.enum(D.QUOTE_LINE_KINDS),
    label: z.string(),
    quantity: z.number(),
    unitPriceCents: z.number().int(),
    catalogCode: z.string().nullable(),
});

export const Quote = z.object({
    id,
    number: z.string(),
    status: z.enum(D.QUOTE_STATUSES),
    title: z.string(),
    notes: z.string().nullable(),
    warnings: z.array(z.string()),
    vatRate: z.number(),
    createdAt: date,
    validatedAt: date.nullable(),
    sentAt: date.nullable(),
    decidedAt: date.nullable(),
    clientId: id,
    client: Client,
    lines: z.array(QuoteLine),
    intervention: Ref({ number: z.number().int(), title: z.string() }).nullable(),
    report: Ref({}).nullable(),
    request: Ref({ subject: z.string() }).nullable(),
    totalHtCents: z.number().int(),
    vatCents: z.number().int(),
    totalTtcCents: z.number().int(),
});

export const QuoteDetail = Quote.extend({
    timeline: z.array(Activity),
    messages: z.array(OutboundMessage),
});

export const ClientDetail = Client.extend({
    sites: z.array(SiteWithEquipments),
    contracts: z.array(Contract),
    interventions: z.array(InterventionBase.extend({ technician: Technician.nullable(), equipment: Equipment.nullable() })),
    quotes: z.array(z.object({ id, number: z.string(), status: z.enum(D.QUOTE_STATUSES), title: z.string(), createdAt: date, lines: z.array(QuoteLine) })),
});

export const Dashboard = z.object({
    aiProvider: z.string(),
    counters: z.object({
        requestsTotal: z.number().int(),
        requestsPending: z.number().int(),
        urgentPending: z.number().int(),
        interventionsToday: z.number().int(),
        toSchedule: z.number().int(),
        toDispatch: z.number().int(),
        reportsPending: z.number().int(),
        quotesDraft: z.number().int(),
        quotesSent: z.number().int(),
        messagesFailed: z.number().int(),
    }),
    activity: z.array(Activity),
});

/** Corps d'erreur renvoyé par l'API (NestJS). */
export const ApiErrorBody = z.object({
    statusCode: z.number().int(),
    message: z.union([z.string(), z.array(z.string())]),
});
