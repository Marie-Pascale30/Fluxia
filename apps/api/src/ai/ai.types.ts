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

/** Contrat commun à tous les moteurs d'IA (heuristique locale, Claude…). */
export interface AiProvider {
    readonly name: string;
    analyzeRequest(input: AnalyzeRequestInput): Promise<RequestAnalysis>;
    draftReport(input: DraftReportInput): Promise<ReportDraft>;
    suggestQuote(input: SuggestQuoteInput): Promise<QuoteSuggestion>;
}

export interface AiResult<T> {
    data: T;
    provider: string;
}
