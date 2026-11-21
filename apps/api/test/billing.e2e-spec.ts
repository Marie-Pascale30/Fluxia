// Abonnement : essai gratuit, webhook Stripe signé, lecture seule sans abonnement actif.
import { createHmac } from 'node:crypto';
import { call, useToken } from './client.js';

const SECRET = 'whsec_test_fluxia';
let organizationId: string;
let eventSeq = 0;

/** Envoie un événement Stripe signé comme le ferait Stripe (en-tête Stripe-Signature). */
async function stripeEvent(type: string, object: object, created = Math.floor(Date.now() / 1000) + eventSeq++) {
    const payload = JSON.stringify({ id: `evt_test_${created}_${type}`, object: 'event', type, created, data: { object } });
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', SECRET).update(`${t}.${payload}`).digest('hex');
    const res = await fetch(`http://localhost:${process.env.E2E_API_PORT ?? 4610}/api/billing/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` },
        body: payload,
    });
    return res.status;
}

const subscription = (status: string, periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400) => ({
    id: `sub_test_${organizationId}`,
    object: 'subscription',
    customer: `cus_test_${organizationId}`,
    status,
    metadata: { organizationId },
    items: { data: [{ current_period_end: periodEnd }] },
});

beforeAll(async () => {
    const res = await call('POST', '/auth/signup', {
        organizationName: 'Froid Services',
        name: 'Hugo Lambert',
        email: `hugo.lambert.${Date.now()}@froid-services.fr`,
        password: 'un-mot-de-passe-solide',
        acceptTerms: true,
    }, { token: null });
    useToken(res.body.token);
    organizationId = res.body.user.organizationId;
});

describe('Abonnement', () => {
    it('démarre par un essai gratuit de 14 jours', async () => {
        const billing = (await call('GET', '/billing')).body;
        expect(billing).toMatchObject({ status: 'TRIALING', trialDaysLeft: 14, canWrite: true, configured: false });
    });

    it('sans configuration Stripe, la souscription en ligne est indisponible', async () => {
        expect((await call('POST', '/billing/checkout')).status).toBe(503);
    });

    it('refuse un événement non signé ou falsifié', async () => {
        const forged = await fetch(`http://localhost:${process.env.E2E_API_PORT ?? 4610}/api/billing/webhook`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=abc' },
            body: JSON.stringify({ type: 'customer.subscription.updated', data: { object: subscription('active') } }),
        });
        expect(forged.status).toBe(400);
    });

    it('résilié : lecture seule (consultation et paramètres toujours possibles)', async () => {
        expect(await stripeEvent('customer.subscription.deleted', subscription('canceled'))).toBe(200);
        expect((await call('GET', '/billing')).body).toMatchObject({ status: 'CANCELED', canWrite: false });

        const blocked = await call('POST', '/clients', { name: 'Nouveau client' });
        expect(blocked.status).toBe(402);
        expect(blocked.body.message).toContain('Abonnement');
        expect((await call('GET', '/clients')).status).toBe(200);
        expect((await call('PATCH', '/organization', { phone: '01 00 00 00 00' })).status).toBe(200);
    });

    it('abonnement actif : modifications rétablies, échéance enregistrée', async () => {
        const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;
        expect(await stripeEvent('customer.subscription.updated', subscription('active', periodEnd))).toBe(200);
        const billing = (await call('GET', '/billing')).body;
        expect(billing).toMatchObject({ status: 'ACTIVE', canWrite: true, hasCustomer: true });
        expect(new Date(billing.currentPeriodEnd).getTime()).toBe(periodEnd * 1000);
        expect((await call('POST', '/clients', { name: 'Nouveau client' })).status).toBe(201);
    });

    it('ignore un événement plus ancien reçu en retard', async () => {
        expect(await stripeEvent('customer.subscription.updated', subscription('past_due'), Math.floor(Date.now() / 1000) - 3600)).toBe(200);
        expect((await call('GET', '/billing')).body.status).toBe('ACTIVE');
    });

    it('l’entreprise de démo (antérieure à la facturation) reste active', async () => {
        const { token } = (await call('POST', '/auth/login', { email: 'julien@fluxia.fr', password: 'fluxia-demo' }, { token: null })).body;
        expect((await call('GET', '/billing', undefined, { token })).body).toMatchObject({ status: 'ACTIVE', canWrite: true });
    });
});
