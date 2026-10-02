import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
    AiProvider,
    AiResult,
    AnalyzeRequestInput,
    DraftReportInput,
    QuoteSuggestion,
    ReportDraft,
    RequestAnalysis,
    SuggestQuoteInput,
} from './ai.types.js';
import { ClaudeProvider } from './claude.provider.js';
import { HeuristicProvider } from './heuristic.provider.js';

/**
 * Point d'entrée unique de l'IA.
 * - ANTHROPIC_API_KEY défini → Claude, avec repli automatique sur l'heuristique en cas d'erreur.
 * - sinon → moteur heuristique local.
 * AI_PROVIDER=heuristic force le moteur local.
 */
@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private readonly fallback = new HeuristicProvider();
    private readonly primary: AiProvider;

    constructor(config: ConfigService) {
        const apiKey = config.get<string>('ANTHROPIC_API_KEY');
        const forced = config.get<string>('AI_PROVIDER');
        this.primary = apiKey && forced !== 'heuristic' ? new ClaudeProvider(apiKey) : this.fallback;
        this.logger.log(`Moteur IA : ${this.primary.name}`);
    }

    get providerName() {
        return this.primary.name;
    }

    private async run<T>(task: string, call: (p: AiProvider) => Promise<T>): Promise<AiResult<T>> {
        if (this.primary === this.fallback) return { data: await call(this.fallback), provider: this.fallback.name };
        try {
            return { data: await call(this.primary), provider: this.primary.name };
        } catch (error) {
            this.logger.warn(`${task} : échec ${this.primary.name} (${(error as Error).message}), repli heuristique`);
            return { data: await call(this.fallback), provider: `${this.fallback.name} (repli)` };
        }
    }

    analyzeRequest(input: AnalyzeRequestInput): Promise<AiResult<RequestAnalysis>> {
        return this.run('analyzeRequest', (p) => p.analyzeRequest(input));
    }

    draftReport(input: DraftReportInput): Promise<AiResult<ReportDraft>> {
        return this.run('draftReport', (p) => p.draftReport(input));
    }

    suggestQuote(input: SuggestQuoteInput): Promise<AiResult<QuoteSuggestion>> {
        return this.run('suggestQuote', (p) => p.suggestQuote(input));
    }
}
