import type { Organization } from '../generated/prisma/client.js';

// Règles d'accès liées à l'abonnement (fonctions pures, testées).

export const TRIAL_DAYS = () => Number(process.env.TRIAL_DAYS ?? 14);

type Subscription = Pick<Organization, 'subscriptionStatus' | 'trialEndsAt'>;

/**
 * L'entreprise peut-elle créer et modifier des données ?
 * Essai en cours, abonnement actif, ou paiement en retard (Stripe relance le client : délai de grâce).
 * Sinon l'espace reste consultable en lecture seule.
 */
export function canWrite(org: Subscription, now = new Date()): boolean {
    switch (org.subscriptionStatus) {
        case 'ACTIVE':
        case 'PAST_DUE':
            return true;
        case 'TRIALING':
            return !!org.trialEndsAt && org.trialEndsAt > now;
        case 'CANCELED':
            return false;
    }
}

/** Statut Stripe d'un abonnement → statut Fluxia ; null = pas de changement (ex. premier paiement en cours). */
export function mapStripeStatus(status: string): Organization['subscriptionStatus'] | null {
    switch (status) {
        case 'active':
        case 'trialing':
            return 'ACTIVE';
        case 'past_due':
            return 'PAST_DUE';
        case 'canceled':
        case 'unpaid':
        case 'incomplete_expired':
        case 'paused':
            return 'CANCELED';
        default:
            return null;
    }
}

/** Jours d'essai restants (arrondi supérieur), 0 si terminé. */
export function trialDaysLeft(org: Subscription, now = new Date()): number {
    if (org.subscriptionStatus !== 'TRIALING' || !org.trialEndsAt) return 0;
    return Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
}
