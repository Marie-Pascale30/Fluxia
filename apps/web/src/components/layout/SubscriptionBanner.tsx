import Link from 'next/link';
import type { Billing } from '@/lib/types';

/** Rappel d'abonnement : fin d'essai proche, lecture seule, paiement en retard. */
export function SubscriptionBanner({ billing }: { billing: Billing }) {
    let text: string | null = null;
    let tone = 'warning';
    if (!billing.canWrite) {
        text = billing.status === 'TRIALING' ? 'Votre essai est terminé : l’espace est en lecture seule.' : 'Votre abonnement est inactif : l’espace est en lecture seule.';
        tone = 'danger';
    } else if (billing.status === 'PAST_DUE') {
        text = 'Le dernier paiement de votre abonnement a échoué : mettez à jour votre moyen de paiement.';
    } else if (billing.status === 'TRIALING' && billing.trialDaysLeft <= 7) {
        text = `Essai gratuit : ${billing.trialDaysLeft} jour${billing.trialDaysLeft > 1 ? 's' : ''} restant${billing.trialDaysLeft > 1 ? 's' : ''}.`;
        tone = '';
    }
    if (!text) return null;
    return (
        <div className={['notice', tone, 'mb'].filter(Boolean).join(' ')} role="status">
            {text} <Link href="/abonnement">Voir l’abonnement</Link>
        </div>
    );
}
