import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import {
    EQUIPMENT_TYPES,
    PRIORITIES,
    QUOTE_LINE_KINDS,
    REQUEST_CATEGORIES,
    SUGGESTED_ACTIONS,
} from '../common/domain.js';
import type {
    AiProvider,
    AnalyzeRequestInput,
    CatalogEntry,
    DraftReplyInput,
    ReplyDraft,
    DraftReportInput,
    QuoteSuggestion,
    ReportDraft,
    RequestAnalysis,
    SuggestQuoteInput,
} from './ai.types.js';

const MODEL = 'claude-opus-5-5';

const SYSTEM = `Tu es l'assistant administratif de Fluxia, un logiciel pour entreprises de maintenance CVC
(climatisation, chauffage, ventilation, plomberie, électricité). Tu réponds en français, de façon factuelle
et concise. Tu n'inventes jamais d'information absente du texte fourni : si une donnée manque, utilise null
ou une formulation "à préciser". Tes propositions sont relues et validées par un humain avant toute action.`;

const RequestAnalysisSchema = z.object({
    category: z.enum(REQUEST_CATEGORIES),
    priority: z.enum(PRIORITIES),
    summary: z.string().describe('Une phrase : ce que le client demande et pourquoi.'),
    symptoms: z.array(z.string()).describe('Symptômes techniques observés, formulés courts.'),
    equipmentType: z.enum(EQUIPMENT_TYPES).nullable(),
    suggestedAction: z.enum(SUGGESTED_ACTIONS),
    confidence: z.number().describe('Confiance globale entre 0 et 1.'),
    contactPhone: z.string().nullable().describe("Téléphone de l'expéditeur s'il figure dans le message."),
    contactAddress: z.string().nullable().describe("Adresse d'intervention si elle figure dans le message."),
});

const ReplySchema = z.object({
    subject: z.string(),
    body: z.string().describe('Corps du mail en texte brut, avec formule de politesse et signature.'),
});

const ReportDraftSchema = z.object({
    reason: z.string(),
    diagnosis: z.string(),
    workDone: z.string(),
    result: z.string(),
    recommendation: z.string().nullable(),
    parts: z.array(
        z.object({
            label: z.string(),
            catalogCode: z.string().nullable().describe('Code du catalogue si la pièce y figure, sinon null.'),
            quantity: z.number(),
        }),
    ),
    laborHours: z.number().describe("Temps de main d'œuvre sur site en heures (0.5 minimum)."),
});

const QuoteSuggestionSchema = z.object({
    title: z.string(),
    lines: z.array(
        z.object({
            catalogCode: z.string().nullable(),
            label: z.string(),
            kind: z.enum(QUOTE_LINE_KINDS),
            quantity: z.number(),
        }),
    ),
    warnings: z.array(z.string()).describe('Points que le responsable doit vérifier avant validation.'),
});

const catalogText = (catalog: CatalogEntry[]) =>
    catalog.map((c) => `- ${c.code} | ${c.kind} | ${c.label}`).join('\n');

export class ClaudeProvider implements AiProvider {
    readonly name = `claude:${MODEL}`;
    private readonly client: Anthropic;

    constructor(apiKey?: string) {
        this.client = new Anthropic(apiKey ? { apiKey } : {});
    }

    private async parse<T>(
        schema: z.ZodType<T>,
        prompt: string,
        effort: 'low' | 'medium',
    ): Promise<T> {
        const response = await this.client.beta.messages.parse({
            model: MODEL,
            max_tokens: 8000,
            system: SYSTEM,
            messages: [{ role: 'user', content: prompt }],
            output_config: { format: betaZodOutputFormat(schema), effort },
            // Si le modèle décline pour raison de politique, l'API bascule sur un modèle de repli.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
        });

        if (response.stop_reason === 'refusal') throw new Error('Requête refusée par le modèle');
        if (response.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (max_tokens)');
        if (!response.parsed_output) throw new Error('Réponse structurée invalide');
        return response.parsed_output as T;
    }

    analyzeRequest(input: AnalyzeRequestInput): Promise<RequestAnalysis> {
        return this.parse(
            RequestAnalysisSchema,
            `Analyse cette demande entrante et qualifie-la.

Règles de priorité : URGENT = panne bloquante ou risque (fuite, arrêt total, établissement recevant du public
impacté) ; HIGH = panne partielle ; NORMAL = demande planifiable ; LOW = information.

<demande>
De : ${input.fromName} <${input.fromEmail}>
Objet : ${input.subject}

${input.body}
</demande>`,
            'low',
        );
    }

    draftReport(input: DraftReportInput): Promise<ReportDraft> {
        return this.parse(
            ReportDraftSchema,
            `Rédige le rapport d'intervention à partir du compte rendu oral du technicien.
Style professionnel destiné au client final, phrases courtes. Liste les pièces remplacées ou fournies ;
rattache-les au catalogue quand c'est possible.

Intervention : ${input.interventionTitle}
Problème signalé : ${input.problem}
Équipement : ${input.equipmentLabel ?? 'non précisé'}

<catalogue>
${catalogText(input.catalog)}
</catalogue>

<compte_rendu_technicien>
${input.voiceNote}
</compte_rendu_technicien>`,
            'medium',
        );
    }

    draftReply(input: DraftReplyInput): Promise<ReplyDraft> {
        return this.parse(
            ReplySchema,
            `Rédige une réponse courte et chaleureuse au client, en français, en vouvoyant.
N'annonce que les faits listés ci-dessous : ne promets ni date ni prix qui n'y figurent pas.
Signe avec : ${input.signature}

Client : ${input.clientName ?? 'non identifié'}
Faits établis :
${input.facts.map((f) => `- ${f}`).join('\n') || '- aucun pour le moment (accuser réception et annoncer un retour rapide)'}

<message_client>
De : ${input.fromName}
Objet : ${input.subject}

${input.body}
</message_client>`,
            'low',
        );
    }

    suggestQuote(input: SuggestQuoteInput): Promise<QuoteSuggestion> {
        return this.parse(
            QuoteSuggestionSchema,
            `Prépare un brouillon de devis pour cette demande client. Utilise en priorité les codes du catalogue
(les prix sont appliqués côté serveur, ne les indique pas). Ajoute une ligne de main d'œuvre (MO-H, en heures)
et une ligne de déplacement (DEPL) si une intervention sur site est nécessaire.

<catalogue>
${catalogText(input.catalog)}
</catalogue>

<demande>
Objet : ${input.subject}

${input.body}
</demande>`,
            'medium',
        );
    }
}
