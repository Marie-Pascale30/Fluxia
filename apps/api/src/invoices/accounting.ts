// Export du journal des ventes (CSV) pour import dans un logiciel comptable.
// Une facture produit 3 lignes équilibrées : client au débit (TTC),
// produits (HT) et TVA collectée au crédit. Un avoir inverse le sens.

import { formatShortDateFr } from '../common/dates.js';

/** Comptes par défaut (modifiables dans les paramètres de l'entreprise). */
export const DEFAULT_ACCOUNTS = {
    revenue: '706000', // Prestations de services
    vat: '445710', // TVA collectée
};

const CLIENT_PREFIX = '411';

export interface SalesEntry {
    date: Date;
    number: string;
    clientName: string;
    htCents: number;
    vatCents: number;
    ttcCents: number;
    /** Avoir : écritures inversées */
    credit?: boolean;
}

/** Compte client auxiliaire : 411 + nom normalisé (ex. 411SCIRIVOL). */
export function clientAccount(name: string) {
    const slug = name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8);
    return `${CLIENT_PREFIX}${slug || 'DIVERS'}`;
}

const amount = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const cell = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function salesJournalCsv(entries: SalesEntry[], accounts = DEFAULT_ACCOUNTS): string {
    const rows: string[][] = [['Date', 'Journal', 'Pièce', 'Compte', 'Libellé', 'Débit', 'Crédit']];
    for (const e of entries) {
        const label = `${e.credit ? 'Avoir' : 'Facture'} ${e.number} ${e.clientName}`;
        const date = formatShortDateFr(e.date);
        const lines: [string, number, number][] = [
            [clientAccount(e.clientName), e.ttcCents, 0],
            [accounts.revenue, 0, e.htCents],
            [accounts.vat, 0, e.vatCents],
        ];
        for (const [account, debit, credit] of lines) {
            const [d, c] = e.credit ? [credit, debit] : [debit, credit];
            rows.push([date, 'VT', e.number, account, label, d ? amount(d) : '', c ? amount(c) : '']);
        }
    }
    // BOM : ouverture correcte des accents dans Excel
    return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
