import { headers } from 'next/headers';
import Link from 'next/link';
import { rotateInboundToken, updateOrganization } from '@/app/actions';
import { deleteOrganization } from '@/app/auth-actions';
import { PasswordForm } from '@/features/account/PasswordForm';
import { Card, Notice, PageHeader } from '@/components/ui';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActionForm } from '@/components/ui/ActionForm';
import { api } from '@/lib/api';

export const metadata = { title: 'Paramètres' };

/** Adresse publique du site (pour l'URL du webhook), d'après la requête en cours. */
async function siteUrl() {
    if (process.env.PUBLIC_WEB_URL) return process.env.PUBLIC_WEB_URL.replace(/\/$/, '');
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
}

export default async function SettingsPage({ searchParams }: PageProps<'/parametres'>) {
    const [organization, { bienvenue }, base] = await Promise.all([api.organization.get(), searchParams, siteUrl()]);
    const webhook = `${base}/api/inbound/email?token=${encodeURIComponent(organization.inboundToken)}`;

    return (
        <>
            <PageHeader title="Paramètres" subtitle="Coordonnées et réglages propres à votre entreprise : ils figurent sur vos devis, rapports, factures et emails." />

            {bienvenue && (
                <Notice tone="success">
                    Bienvenue sur Fluxia ! Complétez vos coordonnées et mentions légales, puis ajoutez vos techniciens, vos clients et vos tarifs.
                </Notice>
            )}

            <Card className="mb" title="Entreprise">
                <ActionForm action={updateOrganization} submitLabel="Enregistrer">
                    <div className="form-row">
                        <label>
                            Nom
                            <input name="name" className="input" required minLength={2} maxLength={120} defaultValue={organization.name} />
                        </label>
                        <label>
                            Téléphone
                            <input name="phone" className="input" maxLength={40} defaultValue={organization.phone} />
                        </label>
                        <label>
                            Email de contact (reçoit les réponses des clients)
                            <input name="email" type="email" className="input" maxLength={120} defaultValue={organization.email} />
                        </label>
                    </div>
                    <label>
                        Adresse
                        <input name="address" className="input" maxLength={300} defaultValue={organization.address} placeholder="12 rue Exemple, 75011 Paris" />
                    </label>
                    <label>
                        Mentions légales (obligatoires sur les factures)
                        <input
                            name="legal"
                            className="input"
                            maxLength={500}
                            defaultValue={organization.legal}
                            placeholder="SAS au capital de 10 000 € · SIRET … · RCS … · TVA FR…"
                        />
                    </label>
                    <label>
                        Signature des emails
                        <input name="signature" className="input" maxLength={200} defaultValue={organization.signature} />
                    </label>
                    <div className="form-row">
                        <label>
                            Délai de paiement (jours)
                            <input name="paymentTermsDays" type="number" min={0} max={60} className="input" defaultValue={organization.paymentTermsDays} />
                        </label>
                        <label>
                            Compte de produits
                            <input name="accountRevenue" className="input" pattern="\d{3,10}" defaultValue={organization.accountRevenue} />
                        </label>
                        <label>
                            Compte de TVA collectée
                            <input name="accountVat" className="input" pattern="\d{3,10}" defaultValue={organization.accountVat} />
                        </label>
                    </div>
                </ActionForm>
            </Card>

            <Card title="Réception des emails">
                <p className="muted">
                    Faites suivre les emails de vos clients vers Fluxia : chaque message devient une demande dans l’Inbox, analysée par l’IA. Indiquez cette
                    adresse comme webhook d’emails entrants chez votre fournisseur (Postmark, Mailgun, SendGrid…).
                </p>
                <div className="secret mt" aria-label="Adresse du webhook">
                    {webhook}
                </div>
                <p className="muted small mt">Gardez cette adresse secrète : elle permet de déposer des demandes dans votre Inbox.</p>
                <div className="mt">
                    <ActionButton
                        action={rotateInboundToken}
                        variant="light"
                        confirm="L’adresse actuelle cessera immédiatement de fonctionner. Générer une nouvelle adresse ?"
                    >
                        Générer une nouvelle adresse
                    </ActionButton>
                </div>
            </Card>

            <Card className="mt" title="Données et confidentialité">
                <p className="muted">
                    Téléchargez à tout moment l’ensemble des données de votre entreprise dans un format réutilisable (JSON) : clients, interventions,
                    rapports, devis, factures, historique. Voir la <Link href="/confidentialite">politique de confidentialité</Link>.
                </p>
                <a className="btn light" href="/export/donnees">
                    Exporter toutes les données
                </a>

                <details className="mt">
                    <summary className="strong">Supprimer l’entreprise</summary>
                    <Notice tone="danger">
                        Suppression définitive et immédiate de l’entreprise, de tous les comptes, de toutes les données et de tous les fichiers. Exportez
                        d’abord vos données : vos factures doivent être conservées 10 ans (obligation comptable).
                    </Notice>
                    <PasswordForm action={deleteOrganization} submitLabel="Supprimer définitivement">
                        <div className="form-row">
                            <label>
                                Nom de l’entreprise, pour confirmer
                                <input name="confirmName" className="input" required placeholder={organization.name} autoComplete="off" />
                            </label>
                            <label>
                                Votre mot de passe
                                <input name="password" type="password" className="input" required autoComplete="current-password" />
                            </label>
                        </div>
                    </PasswordForm>
                </details>
            </Card>
        </>
    );
}
