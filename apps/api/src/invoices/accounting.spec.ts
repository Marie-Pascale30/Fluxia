import { fromZoned } from '../common/dates.js';
import { clientAccount, salesJournalCsv } from './accounting.js';

const parse = (csv: string) =>
    csv
        .replace(/^﻿/, '')
        .trim()
        .split('\r\n')
        .map((l) => l.split(';'));
const cents = (v: string) => (v ? Math.round(Number(v.replace(',', '.')) * 100) : 0);

describe('journal des ventes', () => {
    const invoice = { date: fromZoned(2026, 10, 2), number: 'F-2026-0001', clientName: 'SCI Rivoli', htCents: 61500, vatCents: 12300, ttcCents: 73800 };

    it('produit des écritures équilibrées pour une facture', () => {
        const [header, ...rows] = parse(salesJournalCsv([invoice]));
        expect(header).toEqual(['Date', 'Journal', 'Pièce', 'Compte', 'Libellé', 'Débit', 'Crédit']);
        expect(rows.map((r) => r[3])).toEqual(['411SCIRIVOL', '706000', '445710']);
        expect(rows[0][0]).toBe('02/10/2026');
        const debit = rows.reduce((s, r) => s + cents(r[5]), 0);
        const credit = rows.reduce((s, r) => s + cents(r[6]), 0);
        expect(debit).toBe(73800);
        expect(credit).toBe(73800);
    });

    it('inverse le sens pour un avoir', () => {
        const [, client] = parse(salesJournalCsv([{ ...invoice, number: 'A-2026-0001', credit: true }]));
        expect(client[5]).toBe('');
        expect(client[6]).toBe('738,00');
        expect(client[4]).toContain('Avoir A-2026-0001');
    });

    it('protège les libellés contenant un séparateur', () => {
        const csv = salesJournalCsv([{ ...invoice, clientName: 'Durand; Fils & "Cie"' }]);
        expect(csv).toContain('"Facture F-2026-0001 Durand; Fils & ""Cie"""');
    });

    it('normalise le compte client', () => {
        expect(clientAccount('Hôtel du Marais')).toBe('411HOTELDUM');
        expect(clientAccount('***')).toBe('411DIVERS');
    });
});
