import type {
    EquipmentType,
    Priority,
    QuoteLineKind,
    RequestCategory,
    SuggestedAction,
} from '../common/domain.js';

export interface CatalogEntry {
    code: string;
    label: string;
    kind: QuoteLineKind;
    keywords: string[];
}

export interface AnalyzeRequestInput {
    subject: string;
    body: string;
    fromName: string;
    fromEmail: string;
}

export interface RequestAnalysis {
    category: RequestCategory;
    priority: Priority;
    summary: string;
    symptoms: string[];
    equipmentType: EquipmentType | null;
    suggestedAction: SuggestedAction;
    /** 0..1 */
    confidence: number;
    /** Coordonnées repérées dans le message (utile pour un expéditeur inconnu) */
    contactPhone: string | null;
    contactAddress: string | null;
}

export interface DraftReportInput {
    interventionTitle: string;
    problem: string;
    equipmentLabel: string | null;
    voiceNote: string;
    catalog: CatalogEntry[];
}

export interface ReportPart {
    label: string;
    catalogCode: string | null;
    quantity: number;
}

export interface ReportDraft {
    reason: string;
    diagnosis: string;
    workDone: string;
    result: string;
    recommendation: string | null;
    parts: ReportPart[];
    laborHours: number;
}

export interface SuggestQuoteInput {
    subject: string;
    body: string;
    catalog: CatalogEntry[];
}

export interface QuoteSuggestion {
    title: string;
    lines: { catalogCode: string | null; label: string; kind: QuoteLineKind; quantity: number }[];
    warnings: string[];
}

export interface DraftReplyInput {
    fromName: string;
    subject: string;
    body: string;
    category: RequestCategory | null;
    clientName: string | null;
    /** Faits établis à mentionner (intervention planifiée, devis en cours…) */
    facts: string[];
    signature: string;
}

export interface ReplyDraft {
    subject: string;
    body: string;
}

/** Contrat commun à tous les moteurs d'IA (heuristique locale, Claude…). */
export interface AiProvider {
    readonly name: string;
    analyzeRequest(input: AnalyzeRequestInput): Promise<RequestAnalysis>;
    draftReport(input: DraftReportInput): Promise<ReportDraft>;
    suggestQuote(input: SuggestQuoteInput): Promise<QuoteSuggestion>;
    draftReply(input: DraftReplyInput): Promise<ReplyDraft>;
}

export interface AiResult<T> {
    data: T;
    provider: string;
}
