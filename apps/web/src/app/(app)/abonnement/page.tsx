import { openBillingPortal, startCheckout } from '@/app/actions';
import { Badge, Card, Notice, PageHeader } from '@/components/ui';
import { ActionButton } from '@/components/ui/ActionButton';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Billing } from '@/lib/types';

export const metadata = { title: 'Abonnement' };

const STATUS: Record<Billing['status'], { label: string; tone: 'green' | 'blue' | 'orange' | 'red' }> = {
    TRIALING: { label: 'Essai gratuit', tone: 'blue' },
    ACTIVE: { label: 'Abonnement actif', tone: 'green' },
    PAST_DUE: { label: 'Paiement en retard', tone: 'orange' },
    CANCELED: { label: 'Abonnement inactif', tone: 'red' },
};

export default async function BillingPage({ searchParams }: PageProps<'/abonnement'>) {
    const [billing, { succes }] = await Promise.all([api.billing.status(), searchParams]);
    const status = STATUS[billing.status];

    return (
        <>
            <PageHeader title="Abonnement" subtitle="Votre abonnement à Fluxia : paiement sécurisé par Stripe, sans engagement." />

            {succes && <Notice tone="success">Merci ! Votre abonnement est enregistré ; son activation peut prendre quelques secondes.</Notice>}
            {!billing.canWrite && (
                <Notice tone="warning">Votre espace est en lecture seule : vos données restent consultables, mais rien ne peut être créé ni modifié.</Notice>
            )}

            <Card title="Situation">
                <div className="row-flex">
                    <Badge label={status.label} tone={status.tone} />
                    {billing.status === 'TRIALING' && (
                        <span className="muted">
                            {billing.trialDaysLeft > 0
                                ? `${billing.trialDaysLeft} jour${billing.trialDaysLeft > 1 ? 's' : ''} restant${billing.trialDaysLeft > 1 ? 's' : ''}, jusqu’au ${formatDate(billing.trialEndsAt!)}`
                                : 'Essai terminé'}
                        </span>
                    )}
                    {billing.currentPeriodEnd && billing.status !== 'TRIALING' && (
                        <span className="muted">Période en cours jusqu’au {formatDate(billing.currentPeriodEnd)}</span>
                    )}
                </div>

                {!billing.configured ? (
                    <p className="muted mt">Le paiement en ligne n’est pas encore activé sur cette plateforme. Contactez l’éditeur pour vous abonner.</p>
                ) : (
                    <div className="row-flex mt">
                        {(billing.status === 'TRIALING' || billing.status === 'CANCELED') && (
                            <ActionButton action={startCheckout} pendingLabel="Ouverture du paiement…">
                                S’abonner
                            </ActionButton>
                        )}
                        {billing.hasCustomer && (
                            <ActionButton action={openBillingPortal} variant="light" pendingLabel="Ouverture…">
                                Gérer mon abonnement (carte, factures, résiliation)
                            </ActionButton>
                        )}
                    </div>
                )}
            </Card>
        </>
    );
}
