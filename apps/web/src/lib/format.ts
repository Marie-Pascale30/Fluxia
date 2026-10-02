// Formatage et libellés métier (FR). Fuseau fixe pour un rendu identique serveur / navigateur.
import type {
    Actor,
    EquipmentType,
    InterventionStatus,
    InterventionType,
    Priority,
    QuoteLineKind,
    QuoteStatus,
    ReportStatus,
    RequestCategory,
    RequestStatus,
    SuggestedAction,
} from './types';

export const TIME_ZONE = 'Europe/Paris';

export type Tone = 'red' | 'green' | 'blue' | 'orange' | 'dark' | undefined;
type Labelled = { label: string; tone?: Tone };

const dateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const longDayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const moneyFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string | Date) => timeFmt.format(new Date(iso));
export const formatLongDay = (iso: string | Date) => longDayFmt.format(new Date(iso));
export const formatMoney = (cents: number) => moneyFmt.format(cents / 100);
export const dayKey = (d: string | Date = new Date()) => dayKeyFmt.format(new Date(d));

/** ISO → valeur d'un <input type="datetime-local"> (heure de Paris). */
export function toLocalInput(iso: string | Date) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(new Date(iso))
            .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Valeur "datetime-local" saisie à l'heure de Paris → instant ISO (indépendant du fuseau serveur). */
export function fromLocalInput(value: string): string {
    const [date, time = '00:00'] = value.split('T');
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    const offset = (at: number) => {
        const local = toLocalInput(new Date(at));
        const [ld, lt] = local.split('T');
        const [ly, lmo, lday] = ld.split('-').map(Number);
        const [lh, lmi] = lt.split(':').map(Number);
        return Date.UTC(ly, lmo - 1, lday, lh, lmi) - at;
    };
    let instant = wall - offset(wall);
    instant = wall - offset(instant);
    return new Date(instant).toISOString();
}

/** Minutes écoulées depuis minuit (heure de Paris). */
export function minutesOfDay(iso: string | Date) {
    const [h, m] = toLocalInput(iso).slice(11).split(':').map(Number);
    return h * 60 + m;
}

/** Décale une clé de jour "YYYY-MM-DD" de n jours. */
export function shiftDay(key: string, days: number) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().slice(0, 10);
}

export function formatDateTime(iso: string | Date) {
    return `${formatDate(iso)} ${formatTime(iso)}`;
}

/** "08:42" aujourd'hui, "Hier", sinon la date. */
export function formatRelative(iso: string) {
    const key = dayKey(iso);
    if (key === dayKey()) return formatTime(iso);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === dayKey(yesterday)) return `Hier ${formatTime(iso)}`;
    return formatDate(iso);
}

export function formatSlot(start: string, end?: string | null) {
    const today = dayKey() === dayKey(start);
    const day = today ? "aujourd'hui" : formatLongDay(start);
    return `${day} · ${formatTime(start)}${end ? `–${formatTime(end)}` : ''}`;
}

export const formatDuration = (minutes: number) =>
    minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}`;

export const initials = (first: string, last?: string) =>
    `${first[0] ?? ''}${last?.[0] ?? first[1] ?? ''}`.toUpperCase();

export const PRIORITY: Record<Priority, Labelled> = {
    LOW: { label: 'Basse' },
    NORMAL: { label: 'Normale', tone: 'blue' },
    HIGH: { label: 'Haute', tone: 'orange' },
    URGENT: { label: 'Urgente', tone: 'red' },
};

export const REQUEST_STATUS: Record<RequestStatus, Labelled> = {
    NEW: { label: 'Nouvelle', tone: 'dark' },
    ANALYZED: { label: 'Analysée', tone: 'blue' },
    CONVERTED: { label: 'Traitée', tone: 'green' },
    ANSWERED: { label: 'Répondue', tone: 'green' },
    ARCHIVED: { label: 'Archivée' },
};

export const CATEGORY: Record<RequestCategory, Labelled> = {
    BREAKDOWN: { label: 'Panne', tone: 'red' },
    QUOTE_REQUEST: { label: 'Devis', tone: 'blue' },
    MAINTENANCE: { label: 'Entretien', tone: 'green' },
    OTHER: { label: 'Autre' },
};

export const SUGGESTED_ACTION: Record<SuggestedAction, string> = {
    CREATE_INTERVENTION: 'Créer une intervention et proposer un technicien disponible.',
    PREPARE_QUOTE: 'Préparer un brouillon de devis à partir de la demande.',
    SCHEDULE_MAINTENANCE: "Planifier la visite d'entretien prévue au contrat.",
    REPLY: 'Répondre au client pour qualifier la demande.',
};

export const INTERVENTION_STATUS: Record<InterventionStatus, Labelled> = {
    TO_SCHEDULE: { label: 'À planifier', tone: 'orange' },
    SCHEDULED: { label: 'Planifiée', tone: 'blue' },
    DISPATCHED: { label: 'Mission envoyée', tone: 'blue' },
    IN_PROGRESS: { label: 'En cours', tone: 'dark' },
    COMPLETED: { label: 'Terminée', tone: 'green' },
    CLOSED: { label: 'Clôturée', tone: 'green' },
    CANCELLED: { label: 'Annulée' },
};

export const INTERVENTION_TYPE: Record<InterventionType, string> = {
    BREAKDOWN: 'Dépannage',
    MAINTENANCE: 'Entretien',
    INSTALLATION: 'Installation',
    AFTER_SALES: 'SAV',
};

export const REPORT_STATUS: Record<ReportStatus, Labelled> = {
    DRAFT: { label: 'Brouillon', tone: 'orange' },
    VALIDATED: { label: 'Validé', tone: 'blue' },
    SENT: { label: 'Envoyé', tone: 'green' },
};

export const QUOTE_STATUS: Record<QuoteStatus, Labelled> = {
    DRAFT: { label: 'Brouillon', tone: 'orange' },
    VALIDATED: { label: 'Validé', tone: 'blue' },
    SENT: { label: 'Envoyé', tone: 'dark' },
    ACCEPTED: { label: 'Accepté', tone: 'green' },
    REFUSED: { label: 'Refusé', tone: 'red' },
};

export const LINE_KIND: Record<QuoteLineKind, string> = {
    PART: 'Pièce',
    LABOR: "Main d'œuvre",
    TRAVEL: 'Déplacement',
    OTHER: 'Autre',
};

export const EQUIPMENT: Record<EquipmentType, string> = {
    CLIMATISATION: 'Climatisation',
    CHAUFFAGE: 'Chauffage',
    VMC: 'Ventilation',
    PLOMBERIE: 'Plomberie',
    ELECTRICITE: 'Électricité',
};

export const ACTOR: Record<Actor, string> = {
    AI: 'IA',
    USER: 'Responsable',
    TECHNICIAN: 'Technicien',
    SYSTEM: 'Système',
};

export const providerLabel = (provider: string | null) =>
    !provider ? '—' : provider.startsWith('claude') ? `Claude${provider.includes('repli') ? ' (repli)' : ''}` : provider.includes('repli') ? 'Moteur local (repli)' : 'Moteur local';
