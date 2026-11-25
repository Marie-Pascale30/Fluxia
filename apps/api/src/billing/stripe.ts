import Stripe from 'stripe';

/** Client Stripe, ou null si Stripe n'est pas configuré (démo : aucun paiement possible). */
export function stripeClient(): Stripe | null {
    const key = process.env.STRIPE_SECRET_KEY;
    return key ? new Stripe(key) : null;
}

/** Mode de paiement : désactivé, test (sk_test_…, aucun débit réel) ou réel. */
export function stripeMode(): 'off' | 'test' | 'live' {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !process.env.STRIPE_PRICE_ID) return 'off';
    return key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test';
}
