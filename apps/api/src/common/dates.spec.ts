import { addDays, atTime, dayKey, fromZoned, isWeekend, minutesOfDay, parseDay, startOfDay } from './dates.js';

describe('dates (fuseau métier Europe/Paris)', () => {
    it('convertit une heure murale de Paris en UTC (été / hiver)', () => {
        expect(fromZoned(2026, 7, 1, 8, 0).toISOString()).toBe('2026-07-01T06:00:00.000Z');
        expect(fromZoned(2026, 12, 1, 8, 0).toISOString()).toBe('2026-12-01T07:00:00.000Z');
    });

    it('gère le passage à l’heure d’hiver', () => {
        // 25 octobre 2026 : 03:00 → 02:00
        const before = fromZoned(2026, 10, 24, 10, 0);
        expect(addDays(before, 1).toISOString()).toBe('2026-10-25T09:00:00.000Z');
    });

    it('calcule le début de journée dans le fuseau métier', () => {
        // 23:30 UTC le 30/09 = 01:30 à Paris le 01/10
        const late = new Date('2026-09-30T23:30:00Z');
        expect(dayKey(late)).toBe('2026-10-01');
        expect(startOfDay(late).toISOString()).toBe('2026-09-30T22:00:00.000Z');
    });

    it('place un horaire de travail le bon jour', () => {
        const day = parseDay('2026-10-01');
        expect(atTime(day, 14, 30).toISOString()).toBe('2026-10-01T12:30:00.000Z');
        expect(minutesOfDay(atTime(day, 14, 30))).toBe(14 * 60 + 30);
    });

    it('détecte le week-end selon le calendrier parisien', () => {
        expect(isWeekend(parseDay('2026-10-03'))).toBe(true); // samedi
        expect(isWeekend(parseDay('2026-10-05'))).toBe(false); // lundi
    });
});
