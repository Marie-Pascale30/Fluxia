import { canWrite, mapStripeStatus, trialDaysLeft } from './subscription.js';

const now = new Date('2026-11-21T10:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe('Abonnement', () => {
    it('autorise les modifications pendant l’essai, puis passe en lecture seule', () => {
        expect(canWrite({ subscriptionStatus: 'TRIALING', trialEndsAt: inDays(3) }, now)).toBe(true);
        expect(canWrite({ subscriptionStatus: 'TRIALING', trialEndsAt: inDays(-1) }, now)).toBe(false);
        expect(canWrite({ subscriptionStatus: 'TRIALING', trialEndsAt: null }, now)).toBe(false);
    });

    it('laisse un délai de grâce en cas de paiement en retard, bloque après résiliation', () => {
        expect(canWrite({ subscriptionStatus: 'ACTIVE', trialEndsAt: null }, now)).toBe(true);
        expect(canWrite({ subscriptionStatus: 'PAST_DUE', trialEndsAt: null }, now)).toBe(true);
        expect(canWrite({ subscriptionStatus: 'CANCELED', trialEndsAt: null }, now)).toBe(false);
    });

    it('traduit les statuts Stripe', () => {
        expect(mapStripeStatus('active')).toBe('ACTIVE');
        expect(mapStripeStatus('past_due')).toBe('PAST_DUE');
        expect(mapStripeStatus('unpaid')).toBe('CANCELED');
        expect(mapStripeStatus('canceled')).toBe('CANCELED');
        expect(mapStripeStatus('incomplete')).toBeNull();
    });

    it('compte les jours d’essai restants', () => {
        expect(trialDaysLeft({ subscriptionStatus: 'TRIALING', trialEndsAt: inDays(13.2) }, now)).toBe(14);
        expect(trialDaysLeft({ subscriptionStatus: 'TRIALING', trialEndsAt: inDays(-2) }, now)).toBe(0);
        expect(trialDaysLeft({ subscriptionStatus: 'ACTIVE', trialEndsAt: inDays(5) }, now)).toBe(0);
    });
});
