import Link from 'next/link';
import { Notice } from '@/components/ui';
import { DEMO_NOTICE, operator } from '@/lib/legal';

export const metadata = { title: 'Politique de confidentialité' };

/**
 * Prestataires techniques (sous-traitants ultérieurs) : pays et cadre de transfert.
 * Ne mentionner un accord ou une certification que s'il est vérifié.
 */
const PROCESSORS = [
    {
        name: 'Vercel Inc.',
        purpose: 'Hébergement de l’application web (pages, sessions)',
        country: 'États-Unis',
        framework: 'EU-US Data Privacy Framework (certification déclarée par Vercel)',
        active: 'Actif',
    },
    {
        name: 'Render Services, Inc.',
        purpose: 'Hébergement de l’API et des fichiers déposés',
        country: 'États-Unis (région Ohio)',
        framework: 'À vérifier : aucun accord de sous-traitance spécifique n’a été conclu pour cette démonstration',
        active: 'Actif',
    },
    {
        name: 'Neon',
        purpose: 'Base de données PostgreSQL',
        country: 'États-Unis (AWS us-east-2, Ohio)',
        framework: 'À vérifier : aucun accord de sous-traitance spécifique n’a été conclu pour cette démonstration',
        active: 'Actif',
    },
    {
        name: 'Anthropic PBC',
        purpose: 'Assistance IA (analyse des demandes, rédaction des rapports)',
        country: 'États-Unis',
        framework: 'À vérifier avant activation',
        active: 'Non activé sur la démonstration (moteur local sans envoi de données)',
    },
    {
        name: 'Stripe',
        purpose: 'Paiement de l’abonnement',
        country: 'Irlande / États-Unis',
        framework: 'À vérifier avant activation',
        active: 'Non activé sur la démonstration (aucun paiement)',
    },
    {
        name: 'Fournisseur de transcription audio (API compatible OpenAI, configurable)',
        purpose: 'Transcription des comptes rendus dictés',
        country: 'Selon le fournisseur choisi',
        framework: 'À vérifier avant activation',
        active: 'Non activé sur la démonstration (dictée du navigateur uniquement)',
    },
    {
        name: 'Envoi d’emails et de SMS (SMTP, Twilio)',
        purpose: 'Notifications aux clients et aux techniciens',
        country: 'Selon le fournisseur choisi',
        framework: 'À vérifier avant activation',
        active: 'Non activé : les envois sont simulés',
    },
];

export default function PrivacyPage() {
    return (
        <article className="card stack">
            <h1 className="h1">Politique de confidentialité</h1>
            <p className="muted">Dernière mise à jour : {operator.updatedAt}</p>

            <Notice tone="warning" title="Projet de démonstration">
                {DEMO_NOTICE} N’y saisissez pas de données réelles de clients.
            </Notice>

            <h2>Qui traite vos données ?</h2>
            <p>
                {operator.name}, {operator.status}, exploite cette démonstration de Fluxia. Contact pour toute question relative à vos données :{' '}
                <a href={`mailto:${operator.contact}`}>{operator.contact}</a>.
            </p>
            <p>
                Dans l’usage prévu du logiciel, chaque entreprise utilisatrice reste <b>responsable du traitement</b> des données de ses propres clients
                (fiches clients, demandes, interventions, documents), l’éditeur n’agissant qu’en <b>sous-traitant</b> au sens de l’article 28 du RGPD.
            </p>

            <h2>Quelles données ?</h2>
            <ul>
                <li>Comptes utilisateurs : nom, email, rôle, mot de passe (stocké sous forme d’empreinte, jamais en clair), dates de connexion.</li>
                <li>Données de l’entreprise : coordonnées, mentions légales, réglages de facturation.</li>
                <li>
                    Données saisies dans le service : clients, sites, équipements, demandes reçues, interventions, photos, signatures, enregistrements audio,
                    rapports, devis, factures, messages envoyés.
                </li>
                <li>Journal d’activité : actions effectuées (traçabilité), pour la sécurité et le support.</li>
            </ul>

            <h2>Pourquoi ?</h2>
            <p>
                Fournir le service (exécution du contrat), assurer sa sécurité (intérêt légitime) et respecter les obligations légales, notamment
                comptables et fiscales.
            </p>

            <h2>Qui y a accès ?</h2>
            <p>
                Les données d’une entreprise ne sont accessibles qu’à ses propres utilisateurs, selon leur rôle, et sont cloisonnées techniquement des
                données des autres entreprises. Les emails de sécurité adressés à un utilisateur (lien de réinitialisation du mot de passe) ne sont ni
                affichés aux autres utilisateurs ni inclus dans l’export, et leur contenu n’est pas conservé.
            </p>
            <p>Prestataires techniques intervenant pour le service (sous-traitants ultérieurs) :</p>
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Prestataire</th>
                            <th>Rôle</th>
                            <th>Pays</th>
                            <th>Cadre du transfert hors UE</th>
                            <th>Sur cette démo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {PROCESSORS.map((p) => (
                            <tr key={p.name}>
                                <td>{p.name}</td>
                                <td>{p.purpose}</td>
                                <td>{p.country}</td>
                                <td>{p.framework}</td>
                                <td>{p.active}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p>
                Les données de cette démonstration sont donc hébergées aux États-Unis. Avant toute mise en service réelle, l’hébergement devra être
                rapproché de l’Union européenne ou les transferts encadrés (accords de sous-traitance et clauses contractuelles types).
            </p>

            <h2>Combien de temps ?</h2>
            <ul>
                <li>Comptes, clients, interventions et documents : tant que l’entreprise existe dans le service, jusqu’à sa suppression.</li>
                <li>Demandes entrantes archivées : supprimées automatiquement 24 mois après leur réception.</li>
                <li>Messages envoyés (emails, SMS) : supprimés automatiquement après 12 mois.</li>
                <li>Journal d’activité : supprimé automatiquement après 24 mois.</li>
                <li>Contenu des emails de réinitialisation du mot de passe : jamais conservé (seule une mention « lien envoyé » est gardée).</li>
                <li>
                    Factures émises : elles doivent être conservées 10 ans par l’entreprise qui les émet (article L123-22 du Code de commerce). La
                    suppression d’une entreprise qui a émis des factures est donc bloquée tant que l’export de ses données (qui contient toutes ses
                    factures) n’a pas été téléchargé ; c’est ensuite à l’entreprise de conserver cet export.
                </li>
            </ul>
            <p>Les durées automatiques sont appliquées par une tâche planifiée quotidienne.</p>

            <h2>Fichiers déposés</h2>
            <p>
                Sur cette démonstration, les photos, signatures et enregistrements audio sont stockés sur le disque temporaire du serveur de l’API : ils
                sont effacés à chaque redéploiement ou redémarrage du serveur. Cette limite est propre à la démonstration.
            </p>

            <h2>Vos droits</h2>
            <p>
                Accès, rectification, effacement, limitation, opposition et portabilité. Le responsable d’une entreprise peut exporter toutes ses données et
                supprimer l’entreprise depuis la page Paramètres. Pour toute autre demande : <a href={`mailto:${operator.contact}`}>{operator.contact}</a>.
                Vous pouvez aussi saisir la CNIL (www.cnil.fr).
            </p>

            <h2>Sécurité</h2>
            <p>
                Connexions chiffrées (HTTPS), mots de passe hachés, sessions limitées dans le temps et fermées à la déconnexion et à chaque changement de mot
                de passe, limitation des tentatives de connexion, cloisonnement des données par entreprise, en-têtes de sécurité du navigateur.
            </p>

            <h2>Cookies</h2>
            <p>Fluxia n’utilise qu’un cookie strictement nécessaire : celui de la session de connexion. Aucun cookie publicitaire ni de mesure d’audience.</p>

            <p className="muted">
                Voir aussi les <Link href="/mentions-legales">mentions légales</Link>.
            </p>
        </article>
    );
}
