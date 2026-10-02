// Réception d'emails par webhook et expédition par la boîte d'envoi.
import { schemas as S } from '@fluxia/shared';
import { call, expectContract, login, useToken } from './client.js';

const TOKEN = 'test-inbound-token';
const until = async <T>(check: () => Promise<T | undefined>, timeoutMs = 10_000): Promise<T> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = await check();
        if (value) return value;
        if (Date.now() > deadline) throw new Error('Délai dépassé');
        await new Promise((r) => setTimeout(r, 200));
    }
};

beforeAll(async () => {
    useToken(await login('julien@fluxia.fr'));
});

describe('Webhook email entrant', () => {
    const postmark = {
        FromFull: { Email: 'contact@leparisien.fr', Name: 'Marc Petit' },
        Subject: 'Fuite sous la VMC',
        TextBody: "Bonjour, il y a une fuite d'eau sous la VMC de la cuisine, c'est urgent.\n\nLe 1 oct., Fluxia a écrit :\n> ancien message",
        MessageID: `e2e-${Date.now()}`,
        Attachments: [{}],
    };

    it('refuse un jeton absent ou invalide', async () => {
        expect((await call('POST', '/inbound/email', postmark, { token: null })).status).toBe(403);
        expect((await call('POST', `/inbound/email?token=mauvais`, postmark, { token: null })).status).toBe(403);
    });

    it('crée et analyse la demande, sans l’historique cité', async () => {
        const res = await call('POST', `/inbound/email?token=${TOKEN}`, postmark, { token: null });
        expect(res.status).toBe(200);
        const request = expectContract(S.InboundRequestDetail, (await call('GET', `/requests/${res.body.id}`)).body);
        expect(request).toMatchObject({ status: 'ANALYZED', category: 'BREAKDOWN', attachments: 1 });
        expect(request.client?.name).toBe('Restaurant Le Parisien');
        expect(request.body).not.toContain('ancien message');
    });

    it('n’importe pas deux fois le même email', async () => {
        const first = await call('POST', `/inbound/email?token=${TOKEN}`, postmark, { token: null });
        // Même Message-ID, jeton transmis en en-tête : la demande existante est renvoyée
        const again = await call('POST', '/inbound/email', postmark, { token: null, headers: { 'x-fluxia-token': TOKEN } });
        expect(again.status).toBe(200);
        expect(again.body.id).toBe(first.body.id);
    });

    it('rejette un email illisible', async () => {
        expect((await call('POST', `/inbound/email?token=${TOKEN}`, { from: 'x@y.fr', text: '' }, { token: null })).status).toBe(400);
    });
});

describe('Boîte d’envoi', () => {
    it('expédie les messages en arrière-plan et trace le transport', async () => {
        const requests = (await call('GET', '/requests')).body as { id: string; fromEmail: string }[];
        const target = requests[0];
        await call('POST', `/requests/${target.id}/reply`, { subject: 'Re: test boîte d’envoi', body: 'Bonjour, ceci est un test de la boîte d’envoi.' });

        const sent = await until(async () => {
            const log = expectContract(S.MessageLog, (await call('GET', '/messages')).body);
            return log.messages.find((m) => m.subject === 'Re: test boîte d’envoi' && m.status === 'SENT');
        });
        expect(sent).toMatchObject({ transport: 'log', attempts: 1, recipient: target.fromEmail });
        expect(sent.sentAt).not.toBeNull();
    });

    it('expose l’état des transports', async () => {
        const log = expectContract(S.MessageLog, (await call('GET', '/messages')).body);
        expect(log.transports).toEqual({ email: 'log', sms: 'log' });
    });
});
