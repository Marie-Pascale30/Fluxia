import type { EquipmentType, Priority, RequestCategory, SuggestedAction } from '../common/domain.js';
import type {
    AiProvider,
    AnalyzeRequestInput,
    CatalogEntry,
    DraftReplyInput,
    ReplyDraft,
    DraftReportInput,
    QuoteSuggestion,
    ReportDraft,
    ReportPart,
    RequestAnalysis,
    SuggestQuoteInput,
} from './ai.types.js';

// Moteur local à base de règles : fonctionne sans clé API, déterministe,
// et sert de filet de sécurité si le fournisseur distant échoue.

const normalize = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const hasAny = (text: string, words: string[]) => words.some((w) => text.includes(w));

const EQUIPMENT_KEYWORDS: Record<EquipmentType, string[]> = {
    CLIMATISATION: ['clim', 'climatisation', 'refroidi', 'froid', 'pompe a chaleur', 'pac', 'split'],
    CHAUFFAGE: ['chaudiere', 'chauffage', 'radiateur', 'bruleur', 'eau chaude'],
    VMC: ['vmc', 'ventilation', 'extracteur', 'caisson'],
    PLOMBERIE: ['fuite', 'plomberie', 'canalisation', 'robinet', 'degat des eaux'],
    ELECTRICITE: ['disjoncteur', 'electrique', 'tableau electrique', 'court-circuit'],
};

const URGENT_WORDS = ['urgent', 'urgence', 'rapidement', 'au plus vite', 'des que possible', 'asap', 'bloque', 'fuite', 'plus du tout'];
const BREAKDOWN_WORDS = ['panne', 'ne fonctionne plus', 'ne refroidit', 'ne chauffe', 'bruit', 'fuite', 'hs', 'arret', 'code erreur', 'ne demarre'];
const QUOTE_WORDS = ['devis', 'chiffrage', 'chiffrer', 'tarif', 'prix', 'remplacement'];
const MAINTENANCE_WORDS = ['entretien', 'maintenance annuelle', 'visite annuelle', 'contrat', 'echeance', 'revision'];

const SYMPTOM_PATTERNS: [RegExp, string][] = [
    [/ne refroidit (plus|pas)/, 'Absence de froid'],
    [/ne chauffe (plus|pas)/, 'Absence de chauffage'],
    [/bruit/, 'Bruit inhabituel'],
    [/fuite/, 'Fuite'],
    [/odeur/, 'Odeur anormale'],
    [/code erreur|erreur [a-z]?\d+/, "Code d'erreur affiché"],
    [/ne (demarre|s'allume) (plus|pas)/, 'Ne démarre plus'],
    [/(disjonct|coupe)/, 'Coupures / disjonctions'],
];

const PHONE = /(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/;
const STREET =
    /\b\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|av\.?|boulevard|bd|place|chemin|allée|impasse|quai|cours|route)\b[^,\n.]{2,60}(?:,?\s*\d{5}\s+[A-ZÉÈa-zéèêàç' -]{2,40}[A-Za-zéè])?/i;
const CITY_DISTRICT = /\b(Paris|Lyon|Marseille)\s+(\d{1,2})(?:e|er|ème)\b/i;

/** Téléphone et adresse cités dans un message libre. */
export function extractContact(text: string): { phone: string | null; address: string | null } {
    const phone = PHONE.exec(text)?.[0].replace(/[.-]/g, ' ').replace(/\s+/g, ' ').trim() ?? null;
    const street = STREET.exec(text)?.[0].trim();
    const district = CITY_DISTRICT.exec(text);
    const address = street ?? (district ? `${district[1]} ${district[2]}e` : null);
    return { phone, address };
}

function sentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function detectEquipment(text: string): EquipmentType | null {
    let best: EquipmentType | null = null;
    let bestScore = 0;
    for (const [type, words] of Object.entries(EQUIPMENT_KEYWORDS) as [EquipmentType, string[]][]) {
        const score = words.filter((w) => text.includes(w)).length;
        if (score > bestScore) {
            best = type;
            bestScore = score;
        }
    }
    return best;
}

function matchCatalog(text: string, catalog: CatalogEntry[], kinds: string[] = ['PART']): CatalogEntry[] {
    return catalog.filter((item) => kinds.includes(item.kind) && item.keywords.some((k) => text.includes(normalize(k))));
}

export class HeuristicProvider implements AiProvider {
    readonly name = 'heuristic';

    async analyzeRequest(input: AnalyzeRequestInput): Promise<RequestAnalysis> {
        const text = normalize(`${input.subject}\n${input.body}`);

        const isBreakdown = hasAny(text, BREAKDOWN_WORDS);
        const isQuote = hasAny(text, QUOTE_WORDS);
        const isMaintenance = hasAny(text, MAINTENANCE_WORDS);

        let category: RequestCategory = 'OTHER';
        if (isBreakdown) category = 'BREAKDOWN';
        else if (isQuote) category = 'QUOTE_REQUEST';
        else if (isMaintenance) category = 'MAINTENANCE';

        let priority: Priority = 'NORMAL';
        if (hasAny(text, URGENT_WORDS)) priority = isBreakdown ? 'URGENT' : 'HIGH';
        else if (isBreakdown) priority = 'HIGH';
        else if (category === 'OTHER') priority = 'LOW';

        const suggestedAction: Record<RequestCategory, SuggestedAction> = {
            BREAKDOWN: 'CREATE_INTERVENTION',
            QUOTE_REQUEST: 'PREPARE_QUOTE',
            MAINTENANCE: 'SCHEDULE_MAINTENANCE',
            OTHER: 'REPLY',
        };

        const symptoms = SYMPTOM_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
        const equipmentType = detectEquipment(text);

        const categoryLabel: Record<RequestCategory, string> = {
            BREAKDOWN: 'Panne signalée',
            QUOTE_REQUEST: 'Demande de chiffrage',
            MAINTENANCE: 'Demande d’entretien',
            OTHER: 'Demande à qualifier',
        };
        const summaryParts = [categoryLabel[category]];
        if (symptoms.length) summaryParts.push(symptoms.join(' + ').toLowerCase());
        if (priority === 'URGENT') summaryParts.push('intervention rapide demandée');

        const signals = [isBreakdown, isQuote, isMaintenance, equipmentType !== null].filter(Boolean).length;
        const contact = extractContact(`${input.subject}\n${input.body}`);

        return {
            contactPhone: contact.phone,
            contactAddress: contact.address,
            category,
            priority,
            summary: `${summaryParts.join(' — ')}.`,
            symptoms,
            equipmentType,
            suggestedAction: suggestedAction[category],
            confidence: Math.min(0.95, 0.45 + signals * 0.15),
        };
    }

    async draftReport(input: DraftReportInput): Promise<ReportDraft> {
        const all = sentences(input.voiceNote);
        const pick = (words: string[]) => all.filter((s) => hasAny(normalize(s), words));

        const diagnosis = pick(['trouve', 'constate', 'defectueux', 'hs', 'use', 'encrasse', 'cause', 'origine']);
        const workDone = pick(['remplace', 'verifie', 'nettoye', 'redemarre', 'controle', 'repare', 'change', 'resserre', 'recharge', 'purge']);
        const result = pick(['fonctionne', 'operationnel', 'retabli', 'resolu', 'normalement']);
        const recommendation = pick(['recommande', 'prevoir', 'conseille', 'a prevoir', 'prochain passage']);

        const note = normalize(input.voiceNote);
        // Une pièce n'est comptée que si le technicien mentionne un remplacement / une fourniture
        const replaced = hasAny(note, ['remplace', 'change', 'fourni', 'pose', 'installe']);
        const parts: ReportPart[] = (replaced ? matchCatalog(note, input.catalog) : []).map((item) => ({
            label: item.label,
            catalogCode: item.code,
            quantity: 1,
        }));

        const hours = /(\d+(?:[.,]\d+)?)\s*(h\b|heure)/.exec(note);
        const minutes = /(\d+)\s*(min|minutes)\b/.exec(note);
        const laborHours = hours
            ? Number(hours[1].replace(',', '.'))
            : minutes
              ? Math.max(0.5, Math.round((Number(minutes[1]) / 60) * 2) / 2)
              : 1;

        const clean = (list: string[]) =>
            list
                .map((s) =>
                    s
                        .replace(/^je (recommande|conseille)( de)?\s+/i, 'Prévoir ')
                        .replace(/^j'ai (trouvé|constaté)\s+(que\s+)?/i, '')
                        .replace(/^(j'ai|je l'ai|je les ai|j'|je)\s*/i, ''),
                )
                .join(' ');
        const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

        return {
            reason: input.problem,
            diagnosis: capitalize(clean(diagnosis)) || 'Diagnostic à préciser par le technicien.',
            workDone: capitalize(clean(workDone.filter((s) => !diagnosis.includes(s)))) || 'Travaux à préciser.',
            result: result.length ? 'Équipement opérationnel.' : 'Résultat à confirmer.',
            recommendation: recommendation.length ? capitalize(clean(recommendation)) : null,
            parts,
            laborHours,
        };
    }

    async draftReply(input: DraftReplyInput): Promise<ReplyDraft> {
        const opening: Record<string, string> = {
            BREAKDOWN: 'Nous avons bien reçu votre signalement de panne et le prenons en charge.',
            QUOTE_REQUEST: 'Nous avons bien reçu votre demande de chiffrage et la préparons.',
            MAINTENANCE: "Nous avons bien reçu votre demande d'entretien.",
            OTHER: 'Nous avons bien reçu votre message.',
        };
        const lines = [
            `Bonjour ${input.fromName.split(' ')[0]},`,
            '',
            opening[input.category ?? 'OTHER'],
            ...input.facts.map((f) => `• ${f}`),
            '',
            input.facts.length
                ? 'Nous restons à votre disposition pour toute question.'
                : 'Nous revenons vers vous très rapidement pour vous proposer une solution.',
            '',
            'Cordialement,',
            input.signature,
        ];
        return { subject: `Re: ${input.subject.replace(/^(re|tr|fwd?)\s*:\s*/i, '')}`, body: lines.join('\n') };
    }

    async suggestQuote(input: SuggestQuoteInput): Promise<QuoteSuggestion> {
        const text = normalize(`${input.subject}\n${input.body}`);
        const parts = matchCatalog(text, input.catalog);
        const warnings = ['Quantités et références à confirmer après visite ou photos.'];
        if (!parts.length) warnings.unshift('Aucune pièce du catalogue détectée : lignes à compléter.');

        return {
            title: input.subject.replace(/^(re|tr|fwd?)\s*:\s*/i, ''),
            lines: [
                ...parts.map((p) => ({ catalogCode: p.code, label: p.label, kind: p.kind, quantity: 1 })),
                { catalogCode: 'MO-H', label: "Main d'œuvre", kind: 'LABOR' as const, quantity: parts.length ? 2 : 1 },
                { catalogCode: 'DEPL', label: 'Déplacement', kind: 'TRAVEL' as const, quantity: 1 },
            ],
            warnings,
        };
    }
}
