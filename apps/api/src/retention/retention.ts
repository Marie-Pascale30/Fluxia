// Durées de conservation appliquées automatiquement (documentées dans la politique de confidentialité).

export const RETENTION = {
    /** Demandes entrantes archivées : 24 mois après réception */
    archivedRequestsMonths: 24,
    /** Messages sortants (emails, SMS) : 12 mois */
    outboundMessagesMonths: 12,
    /** Journal d'activité : 24 mois */
    activityMonths: 24,
} as const;

/** Date limite : tout ce qui est antérieur est supprimé. */
export function cutoff(months: number, now = new Date()): Date {
    const date = new Date(now);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date;
}
