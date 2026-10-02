// Types des réponses de l'API Fluxia (apps/api). Les dates arrivent en ISO string.

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type EquipmentType = 'CLIMATISATION' | 'CHAUFFAGE' | 'VMC' | 'PLOMBERIE' | 'ELECTRICITE';
export type RequestStatus = 'NEW' | 'ANALYZED' | 'CONVERTED' | 'ARCHIVED';
export type RequestCategory = 'BREAKDOWN' | 'QUOTE_REQUEST' | 'MAINTENANCE' | 'OTHER';
export type SuggestedAction = 'CREATE_INTERVENTION' | 'PREPARE_QUOTE' | 'SCHEDULE_MAINTENANCE' | 'REPLY';
export type InterventionType = 'BREAKDOWN' | 'MAINTENANCE' | 'INSTALLATION' | 'AFTER_SALES';
export type InterventionStatus =
    | 'TO_SCHEDULE'
    | 'SCHEDULED'
    | 'DISPATCHED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CLOSED'
    | 'CANCELLED';
export type ReportStatus = 'DRAFT' | 'VALIDATED' | 'SENT';
export type QuoteStatus = 'DRAFT' | 'VALIDATED' | 'SENT' | 'ACCEPTED' | 'REFUSED';
export type QuoteLineKind = 'PART' | 'LABOR' | 'TRAVEL' | 'OTHER';
export type Actor = 'AI' | 'USER' | 'TECHNICIAN' | 'SYSTEM';

export interface Equipment {
    id: string;
    siteId: string;
    type: EquipmentType;
    label: string;
    brand: string | null;
    model: string | null;
}

export interface Site {
    id: string;
    clientId: string;
    label: string;
    address: string;
    postalCode: string;
    city: string;
    lat: number;
    lng: number;
    equipments?: Equipment[];
}

export interface Contract {
    id: string;
    reference: string;
    label: string;
    startDate: string;
    endDate: string;
    coversLabor: boolean;
    coversParts: boolean;
    coversTravel: boolean;
    nextServiceDate: string | null;
}

export interface Client {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    contactName: string | null;
}

export interface ClientSummary extends Client {
    siteCount: number;
    interventionCount: number;
    equipmentCount: number;
    activeContract: boolean;
    lastIntervention: { createdAt: string; number: number } | null;
}

export interface Coverage {
    active: boolean;
    reference: string | null;
    coversLabor: boolean;
    coversParts: boolean;
    coversTravel: boolean;
}

export interface Technician {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    skills: EquipmentType[];
    baseLat: number;
    baseLng: number;
}

export interface TechnicianWithLoad extends Technician {
    today: Pick<Intervention, 'id' | 'number' | 'title' | 'status' | 'scheduledStart' | 'scheduledEnd'>[];
    plannedMinutes: number;
}

export interface Activity {
    id: string;
    createdAt: string;
    actor: Actor;
    type: string;
    message: string;
    entityType: string;
    entityId: string;
}

export interface OutboundMessage {
    id: string;
    createdAt: string;
    channel: 'EMAIL' | 'SMS' | 'PUSH';
    recipient: string;
    subject: string;
    body: string;
}

export interface InboundRequest {
    id: string;
    channel: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt: string;
    status: RequestStatus;
    attachments: number;
    category: RequestCategory | null;
    priority: Priority | null;
    summary: string | null;
    symptoms: string[];
    suggestedAction: SuggestedAction | null;
    confidence: number | null;
    aiProvider: string | null;
    clientId: string | null;
    siteId: string | null;
    equipmentId: string | null;
    client: Client | null;
    intervention: { id: string; number: number; status?: InterventionStatus } | null;
    quote: { id: string; number: string; status?: QuoteStatus } | null;
}

export interface InboundRequestDetail extends InboundRequest {
    client: (Client & { sites: (Site & { equipments: Equipment[] })[] }) | null;
    site: Site | null;
    equipment: Equipment | null;
    coverage: Coverage | null;
}

export interface Intervention {
    id: string;
    number: number;
    type: InterventionType;
    priority: Priority;
    status: InterventionStatus;
    title: string;
    description: string;
    initialDiagnosis: string | null;
    estimatedMinutes: number;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    dispatchedAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    closedAt: string | null;
    cancelledReason: string | null;
    createdAt: string;
    clientId: string;
    siteId: string;
    equipmentId: string | null;
    technicianId: string | null;
    client: Client;
    site: Site;
    technician: Technician | null;
}

export interface ReportPart {
    label: string;
    catalogCode: string | null;
    quantity: number;
}

export interface Report {
    id: string;
    interventionId: string;
    status: ReportStatus;
    voiceNote: string;
    reason: string;
    diagnosis: string;
    workDone: string;
    result: string;
    recommendation: string | null;
    parts: ReportPart[];
    laborHours: number;
    billable: boolean;
    billingNotes: string | null;
    aiProvider: string;
    createdAt: string;
    validatedAt: string | null;
    sentAt: string | null;
}

export interface InterventionDetail extends Intervention {
    equipment: Equipment | null;
    request: { id: string; subject: string; fromName: string; receivedAt: string } | null;
    report: Report | null;
    quotes: { id: string; number: string; status: QuoteStatus }[];
    coverage: Coverage;
    timeline: Activity[];
    messages: OutboundMessage[];
}

export interface Mission extends Omit<Intervention, 'technician'> {
    equipment: Equipment | null;
    report: { id: string; status: ReportStatus } | null;
}

export interface TechnicianDetail extends Technician {
    missions: Mission[];
}

export interface Reason {
    label: string;
    detail: string;
    positive: boolean;
}

export interface Recommendation {
    technicianId: string;
    technicianName: string;
    score: number;
    slot: { start: string; end: string } | null;
    distanceKm: number;
    travelMinutes: number;
    skillMatch: boolean;
    reasons: Reason[];
}

export interface BillableLine {
    kind: QuoteLineKind;
    label: string;
    quantity: number;
    unitPriceCents: number;
    catalogCode: string | null;
}

export interface ReportDetail extends Report {
    intervention: Intervention & { equipment: Equipment | null };
    quote: { id: string; number: string; status: QuoteStatus } | null;
    coverage: Coverage;
    billing: { billable: boolean; lines: BillableLine[]; notes: string; warnings: string[] };
    timeline: Activity[];
}

export interface ReportSummary extends Report {
    intervention: Intervention;
    quote: { id: string; number: string; status: QuoteStatus } | null;
}

export interface QuoteLine {
    id: string;
    position: number;
    kind: QuoteLineKind;
    label: string;
    quantity: number;
    unitPriceCents: number;
    catalogCode: string | null;
}

export interface Quote {
    id: string;
    number: string;
    status: QuoteStatus;
    title: string;
    notes: string | null;
    warnings: string[];
    vatRate: number;
    createdAt: string;
    validatedAt: string | null;
    sentAt: string | null;
    decidedAt: string | null;
    clientId: string;
    client: Client;
    lines: QuoteLine[];
    intervention: { id: string; number: number; title: string } | null;
    report: { id: string } | null;
    request: { id: string; subject: string } | null;
    totalHtCents: number;
    vatCents: number;
    totalTtcCents: number;
}

export interface QuoteDetail extends Quote {
    timeline: Activity[];
    messages: OutboundMessage[];
}

export interface CatalogItem {
    id: string;
    code: string;
    kind: QuoteLineKind;
    label: string;
    unitPriceCents: number;
}

export interface ClientDetail extends Client {
    sites: (Site & { equipments: Equipment[] })[];
    contracts: Contract[];
    interventions: (Intervention & { equipment: Equipment | null })[];
    quotes: Quote[];
}

export interface PlanningDay {
    date: string;
    technicians: (Technician & { interventions: Intervention[] })[];
    unscheduled: Intervention[];
}

export interface Dashboard {
    aiProvider: string;
    counters: {
        requestsTotal: number;
        requestsPending: number;
        urgentPending: number;
        interventionsToday: number;
        toSchedule: number;
        toDispatch: number;
        reportsPending: number;
        quotesDraft: number;
        quotesSent: number;
    };
    activity: Activity[];
}
