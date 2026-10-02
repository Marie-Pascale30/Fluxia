// Utilitaires de dates (heure locale du serveur).

export function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function endOfDay(date: Date): Date {
    const d = startOfDay(date);
    d.setDate(d.getDate() + 1);
    return d;
}

export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
}

export function atTime(day: Date, hours: number, minutes = 0): Date {
    const d = startOfDay(day);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

/** Accepte "YYYY-MM-DD" (jour local) ou toute date ISO ; défaut : aujourd'hui. */
export function parseDay(value?: string): Date {
    if (!value) return startOfDay(new Date());
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

export const formatTimeFr = (date: Date) =>
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const formatDateFr = (date: Date) =>
    date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
