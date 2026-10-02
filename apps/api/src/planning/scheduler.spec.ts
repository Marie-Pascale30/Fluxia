import { atTime, fromZoned, zonedParts } from '../common/dates.js';
import { firstFreeSlot, isFree, recommendTechnicians, searchDays, type CandidateTechnician } from './scheduler.js';

// Un mardi, pour éviter les week-ends
const TUESDAY = fromZoned(2026, 9, 29);
const at = (h: number, m = 0) => atTime(TUESDAY, h, m);

const base: Omit<CandidateTechnician, 'id' | 'name'> = {
    skills: ['CLIMATISATION'],
    baseLat: 48.8566,
    baseLng: 2.3522,
    busy: [],
    siteHistory: 0,
    equipmentHistory: 0,
};

describe('firstFreeSlot', () => {
    it('renvoie le début de journée si rien n’est planifié', () => {
        const slot = firstFreeSlot(TUESDAY, [], 60, at(7));
        expect(slot?.start).toEqual(at(8));
    });

    it('respecte la marge entre deux interventions', () => {
        const busy = [{ start: at(8), end: at(10) }];
        const slot = firstFreeSlot(TUESDAY, busy, 60, at(8));
        // 10:00 + 15 min de marge → prochain pas de 30 min : 10:30
        expect(slot?.start).toEqual(at(10, 30));
    });

    it('arrondit "notBefore" au pas de 30 minutes', () => {
        expect(firstFreeSlot(TUESDAY, [], 60, at(13, 10))?.start).toEqual(at(13, 30));
    });

    it('renvoie null si la journée est pleine', () => {
        const busy = [{ start: at(8), end: at(18) }];
        expect(firstFreeSlot(TUESDAY, busy, 30, at(8))).toBeNull();
    });
});

describe('isFree', () => {
    it('détecte un chevauchement', () => {
        expect(isFree({ start: at(9), end: at(10) }, [{ start: at(9, 30), end: at(11) }])).toBe(false);
    });
});

describe('searchDays', () => {
    it('saute le week-end', () => {
        const friday = fromZoned(2026, 10, 2);
        const days = searchDays(friday, 'HIGH');
        expect(days.map((d) => zonedParts(d).weekday)).toEqual([5, 1, 2]);
    });
});

describe('recommendTechnicians', () => {
    const ctx = {
        equipmentType: 'CLIMATISATION' as const,
        site: { lat: 48.8606, lng: 2.3376 },
        durationMinutes: 90,
        priority: 'URGENT' as const,
        now: at(8, 45),
    };

    it('privilégie le technicien compétent, même plus loin', () => {
        const recos = recommendTechnicians(ctx, [
            { ...base, id: 'marc', name: 'Marc', skills: ['CHAUFFAGE'] },
            { ...base, id: 'thomas', name: 'Thomas', baseLat: 48.9, baseLng: 2.25 },
        ]);
        expect(recos[0].technicianId).toBe('thomas');
        expect(recos[1].skillMatch).toBe(false);
    });

    it('prend en compte l’historique sur l’équipement', () => {
        const recos = recommendTechnicians(ctx, [
            { ...base, id: 'a', name: 'A' },
            { ...base, id: 'b', name: 'B', equipmentHistory: 1 },
        ]);
        expect(recos[0].technicianId).toBe('b');
        expect(recos[0].reasons.some((r) => r.label === 'Historique')).toBe(true);
    });

    it('propose un créneau après le temps de trajet', () => {
        const [reco] = recommendTechnicians(ctx, [{ ...base, id: 'a', name: 'A' }]);
        expect(reco.slot!.start.getTime()).toBeGreaterThanOrEqual(ctx.now.getTime());
    });
});
