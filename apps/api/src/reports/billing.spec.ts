import { computeBilling, quoteTotals, type PricedItem } from './billing.js';

const catalog = new Map<string, PricedItem>([
    ['COND-CLIM', { label: 'Condensateur de démarrage', kind: 'PART', unitPriceCents: 8600 }],
    ['MO-H', { label: "Main d'œuvre", kind: 'LABOR', unitPriceCents: 7500 }],
    ['DEPL', { label: 'Déplacement', kind: 'TRAVEL', unitPriceCents: 4500 }],
]);

const part = { label: 'Condensateur', catalogCode: 'COND-CLIM', quantity: 1 };
const contract = { active: true, reference: 'MAINT-01', coversLabor: true, coversParts: false, coversTravel: true };

describe('computeBilling', () => {
    it('facture uniquement la pièce quand le contrat couvre MO et déplacement', () => {
        const res = computeBilling([part], 1, contract, catalog);
        expect(res.billable).toBe(true);
        expect(res.lines.map((l) => l.kind)).toEqual(['PART']);
        expect(res.notes).toContain('MAINT-01');
    });

    it('ne facture rien si tout est couvert', () => {
        const res = computeBilling([part], 1, { ...contract, coversParts: true }, catalog);
        expect(res.billable).toBe(false);
        expect(res.lines).toHaveLength(0);
    });

    it('facture tout sans contrat actif', () => {
        const none = { active: false, reference: null, coversLabor: false, coversParts: false, coversTravel: false };
        const res = computeBilling([part], 1.5, none, catalog);
        expect(res.lines.map((l) => l.kind)).toEqual(['PART', 'LABOR', 'TRAVEL']);
        expect(res.lines[1].quantity).toBe(1.5);
    });

    it('signale une pièce hors catalogue', () => {
        const res = computeBilling([{ label: 'Vanne 4 voies', catalogCode: null, quantity: 1 }], 1, contract, catalog);
        expect(res.lines[0].unitPriceCents).toBe(0);
        expect(res.warnings[0]).toContain('Vanne 4 voies');
    });
});

describe('quoteTotals', () => {
    it('calcule HT, TVA et TTC en centimes', () => {
        expect(quoteTotals([{ quantity: 2, unitPriceCents: 7500 }, { quantity: 1, unitPriceCents: 8600 }], 0.2)).toEqual({
            totalHtCents: 23600,
            vatCents: 4720,
            totalTtcCents: 28320,
        });
    });
});
