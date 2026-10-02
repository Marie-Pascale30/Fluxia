// Dates "métier" : les journées et horaires de travail s'entendent dans le fuseau
// APP_TIMEZONE (défaut Europe/Paris), quel que soit le fuseau du serveur.
// Les instants restent des Date (UTC) ; seules les conversions passent par ce module.

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Europe/Paris';

interface ZonedParts {
    year: number;
    month: number; // 1-12
    day: number;
    hour: number;
    minute: number;
    weekday: number; // 0 = dimanche
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Composantes calendaires d'un instant dans le fuseau métier. */
export function zonedParts(date: Date): ZonedParts {
    const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
    return {
        year: Number(p.year),
        month: Number(p.month),
        day: Number(p.day),
        hour: Number(p.hour),
        minute: Number(p.minute),
        weekday: WEEKDAYS[p.weekday],
    };
}

/** Décalage (ms) du fuseau métier par rapport à UTC à un instant donné. */
function offsetAt(date: Date): number {
    const p = zonedParts(date);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Instant correspondant à une date/heure "murale" du fuseau métier (gère les changements d'heure). */
export function fromZoned(year: number, month: number, day: number, hour = 0, minute = 0): Date {
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    let instant = wall - offsetAt(new Date(wall));
    // Second passage : l'offset peut différer de part et d'autre d'un changement d'heure
    instant = wall - offsetAt(new Date(instant));
    return new Date(instant);
}

export function startOfDay(date: Date): Date {
    const p = zonedParts(date);
    return fromZoned(p.year, p.month, p.day);
}

export function addDays(date: Date, days: number): Date {
    const p = zonedParts(date);
    return fromZoned(p.year, p.month, p.day + days, p.hour, p.minute);
}

export function endOfDay(date: Date): Date {
    return addDays(startOfDay(date), 1);
}

export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
}

/** Même jour (fuseau métier) que `day`, à l'heure indiquée. */
export function atTime(day: Date, hours: number, minutes = 0): Date {
    const p = zonedParts(day);
    return fromZoned(p.year, p.month, p.day, hours, minutes);
}

export const isWeekend = (date: Date) => {
    const { weekday } = zonedParts(date);
    return weekday === 0 || weekday === 6;
};

export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Accepte "YYYY-MM-DD" (jour du fuseau métier) ou toute date ISO ; défaut : aujourd'hui. */
export function parseDay(value?: string): Date {
    if (!value) return startOfDay(new Date());
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) return fromZoned(Number(match[1]), Number(match[2]), Number(match[3]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

/** Clé "YYYY-MM-DD" du jour dans le fuseau métier. */
export function dayKey(date: Date): string {
    const p = zonedParts(date);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export const minutesOfDay = (date: Date) => {
    const p = zonedParts(date);
    return p.hour * 60 + p.minute;
};

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

export const formatTimeFr = (date: Date) =>
    date.toLocaleTimeString('fr-FR', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' });

export const formatDateFr = (date: Date) =>
    date.toLocaleDateString('fr-FR', { timeZone: APP_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' });

export const formatShortDateFr = (date: Date) =>
    date.toLocaleDateString('fr-FR', { timeZone: APP_TIMEZONE });
