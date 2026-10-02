// Facturation : du devis accepté à l'export comptable.
import { schemas as S } from '@fluxia/shared';
import { call, expectContract, login, useToken } from './client.js';

const BASE = `http://localhost:${process.env.E2E_API_PORT ?? 4610}/api`;

/** Devis envoyé puis accepté (portail) pour SCI Rivoli. */
async function acceptedQuote() {
    const request = await call('POST', '/requests', {
        fromName: 'Claire Rousseau',
        fromEmail: 'gestion@sci-rivoli.fr',
        subject: 'Chiffrage remplacement moteur VMC',
        body: 'Merci de chiffrer le remplacement du moteur de VMC.',
    });
    let quote = (await call('POST', `/requests/${request.body.id}/quote`)).body;
    expect((await call('POST', `/quotes/${quote.id}/invoice`)).status).toBe(409); // pas encore accepté
    await call('POST', `/quotes/${quote.id}/validate`);
    await call('POST', `/quotes/${quote.id}/send`);
    quote = (await call('POST', `/quotes/${quote.id}/accept`)).body;
    expect(quote.status).toBe('ACCEPTED');
    return quote;
}

describe('Facturation', () => {
    let token: string;

    beforeAll(async () => {
        token = await login('julien@fluxia.fr');
        useToken(token);
    });

    it('crée la facture d’un devis accepté, une seule fois', async () => {
        const quote = await acceptedQuote();
        const res = await call('POST', `/quotes/${quote.id}/invoice`);
        expect(res.status).toBe(201);
        const invoice = expectContract(S.InvoiceDetail, res.body);
        expect(invoice).toMatchObject({ status: 'DRAFT', number: null, totalTtcCents: quote.totalTtcCents });
        expect((await call('POST', `/quotes/${quote.id}/invoice`)).status).toBe(409);
    });

    it('attribue des numéros continus à l’émission et fige la facture', async () => {
        const first = expectContract(S.InvoiceDetail, (await call('POST', `/quotes/${(await acceptedQuote()).id}/invoice`)).body);
        const second = expectContract(S.InvoiceDetail, (await call('POST', `/quotes/${(await acceptedQuote()).id}/invoice`)).body);

        const a = expectContract(S.InvoiceDetail, (await call('POST', `/invoices/${first.id}/issue`)).body);
        const b = expectContract(S.InvoiceDetail, (await call('POST', `/invoices/${second.id}/issue`)).body);
        expect(a.number).toMatch(/^F-\d{4}-\d{4}$/);
        expect(Number(b.number!.slice(-4))).toBe(Number(a.number!.slice(-4)) + 1);
        expect(a.dueAt).not.toBeNull();
        expect(a.messages[0]?.subject).toContain(a.number!);

        expect((await call('PATCH', `/invoices/${a.id}`, { title: 'Modifiée' })).status).toBe(409);
        expect((await call('DELETE', `/invoices/${a.id}`)).status).toBe(409);
        expect((await call('POST', `/invoices/${a.id}/issue`)).status).toBe(409);

        // Règlement de la première, annulation par avoir de la seconde
        const paid = (await call('POST', `/invoices/${a.id}/pay`, { method: 'TRANSFER' })).body;
        expect(paid).toMatchObject({ status: 'PAID', paymentMethod: 'TRANSFER' });
        const cancelled = (await call('POST', `/invoices/${b.id}/cancel`, { reason: 'Erreur de quantité' })).body;
        expect(cancelled.status).toBe('CANCELLED');
        expect(cancelled.creditNoteNumber).toMatch(/^A-\d{4}-\d{4}$/);
        expect((await call('POST', `/invoices/${a.id}/cancel`, { reason: 'Trop tard' })).status).toBe(409);
    });

    it('supprime un brouillon, refuse une ligne sans prix à l’émission', async () => {
        const draft = (await call('POST', `/quotes/${(await acceptedQuote()).id}/invoice`)).body;
        await call('PATCH', `/invoices/${draft.id}`, { lines: [{ kind: 'OTHER', label: 'À chiffrer', quantity: 1, unitPriceCents: 0 }] });
        expect((await call('POST', `/invoices/${draft.id}/issue`)).status).toBe(400);
        expect((await call('DELETE', `/invoices/${draft.id}`)).status).toBe(200);
    });

    it('génère le PDF et exporte un journal des ventes équilibré', async () => {
        const invoices = expectContract(S.Invoice.array(), (await call('GET', '/invoices')).body);
        const issued = invoices.find((i) => i.number)!;
        const pdf = await fetch(`${BASE}/invoices/${issued.id}/pdf`, { headers: { authorization: `Bearer ${token}` } });
        expect(pdf.headers.get('content-type')).toBe('application/pdf');
        expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');

        const res = await fetch(`${BASE}/invoices/export`, { headers: { authorization: `Bearer ${token}` } });
        expect(res.headers.get('content-type')).toContain('text/csv');
        const rows = (await res.text()).replace(/^﻿/, '').trim().split('\r\n').slice(1).map((l) => l.split(';'));
        const cents = (v: string) => (v ? Math.round(Number(v.replace(',', '.')) * 100) : 0);
        expect(rows.length % 3).toBe(0);
        expect(rows.reduce((s, r) => s + cents(r[5]), 0)).toBe(rows.reduce((s, r) => s + cents(r[6]), 0));
        expect(rows.some((r) => r[2].startsWith('A-'))).toBe(true); // l'avoir figure au journal
    });

    it('expose les factures en retard au tableau de bord', async () => {
        const dashboard = expectContract(S.Dashboard, (await call('GET', '/dashboard')).body);
        expect(dashboard.counters.invoicesOverdue).toBeGreaterThanOrEqual(0);
    });
});
