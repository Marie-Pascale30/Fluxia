// Portail client : accès par lien signé, sans session.
import { schemas as S } from '@fluxia/shared';
import { call, expectContract, login, useToken } from './client.js';

describe('Portail client', () => {
    let clientId: string;
    let token: string;
    let quoteId: string;

    beforeAll(async () => {
        useToken(await login('julien@fluxia.fr'));
        // Devis envoyé à SCI Rivoli, à partir d'une nouvelle demande de chiffrage (test autonome)
        const request = await call('POST', '/requests', {
            fromName: 'Claire Rousseau',
            fromEmail: 'gestion@sci-rivoli.fr',
            subject: 'Chiffrage remplacement circulateur',
            body: "Merci de chiffrer le remplacement du circulateur de la chaufferie de l'immeuble Rivoli.",
        });
        expect(request.body.client?.name).toBe('SCI Rivoli');
        let quote = (await call('POST', `/requests/${request.body.id}/quote`)).body;
        quote = (await call('POST', `/quotes/${quote.id}/validate`)).body;
        quote = (await call('POST', `/quotes/${quote.id}/send`)).body;
        quoteId = quote.id;
        clientId = quote.clientId;

        const { url } = (await call('GET', `/clients/${clientId}/portal-link`)).body;
        token = url.split('/portail/')[1];
    });

    it('affiche les données du client sans session', async () => {
        const res = await call('GET', `/portal/${token}`, undefined, { token: null });
        expect(res.status).toBe(200);
        const summary = expectContract(S.PortalSummary, res.body);
        expect(summary.client.name).toBe('SCI Rivoli');
        expect(summary.quotes.map((q) => q.id)).toContain(quoteId);
        // Aucun brouillon ni information interne exposés
        expect(summary.quotes.every((q) => q.status !== 'DRAFT')).toBe(true);
        expect(JSON.stringify(res.body)).not.toMatch(/warnings|voiceNote|billingNotes/);
    });

    it('refuse un lien falsifié', async () => {
        const forged = `${Buffer.from('autre.1').toString('base64url')}.${token.split('.')[1]}`;
        expect((await call('GET', `/portal/${forged}`, undefined, { token: null })).status).toBe(404);
        expect((await call('GET', `/portal/n-importe-quoi`, undefined, { token: null })).status).toBe(404);
    });

    it('permet d’accepter le devis en ligne, une seule fois', async () => {
        const pdf = await fetch(`http://localhost:${process.env.E2E_API_PORT ?? 4610}/api/portal/${token}/quotes/${quoteId}/pdf`);
        expect(pdf.status).toBe(200);

        const res = await call('POST', `/portal/${token}/quotes/${quoteId}/decision`, { accept: true, name: 'Claire Rousseau' }, { token: null });
        expect(res.status).toBe(200);
        expect(res.body.quotes.find((q: { id: string }) => q.id === quoteId)).toMatchObject({ status: 'ACCEPTED', decisionBy: 'Claire Rousseau' });

        const again = await call('POST', `/portal/${token}/quotes/${quoteId}/decision`, { accept: false, name: 'Claire Rousseau' }, { token: null });
        expect(again.status).toBe(409);

        const detail = expectContract(S.QuoteDetail, (await call('GET', `/quotes/${quoteId}`)).body);
        expect(detail.timeline.some((a) => a.message.includes('accepté en ligne par Claire Rousseau'))).toBe(true);
    });

    it('révoque les anciens liens', async () => {
        const { url } = (await call('POST', `/clients/${clientId}/portal-link/rotate`)).body;
        expect((await call('GET', `/portal/${token}`, undefined, { token: null })).status).toBe(404);
        expect((await call('GET', `/portal/${url.split('/portail/')[1]}`, undefined, { token: null })).status).toBe(200);
    });

    it('inclut le lien du portail dans les emails envoyés', async () => {
        const log = (await call('GET', '/messages')).body;
        const quoteMail = log.messages.find((m: { subject: string }) => m.subject.startsWith('Devis '));
        expect(quoteMail.body).toContain('/portail/');
    });
});
