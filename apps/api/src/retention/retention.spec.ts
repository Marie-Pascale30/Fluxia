import { cutoff } from './retention.js';

describe('durées de conservation', () => {
    it('calcule la date limite en mois calendaires', () => {
        expect(cutoff(12, new Date('2026-11-24T03:00:00Z')).toISOString()).toBe('2025-11-24T03:00:00.000Z');
        expect(cutoff(24, new Date('2026-11-24T03:00:00Z')).toISOString()).toBe('2024-11-24T03:00:00.000Z');
    });
});
