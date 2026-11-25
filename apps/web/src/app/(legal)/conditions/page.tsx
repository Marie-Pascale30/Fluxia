import Link from 'next/link';
import { Notice } from '@/components/ui';
import { DEMO_NOTICE, operator } from '@/lib/legal';

export const metadata = { title: 'Conditions d’utilisation' };

export default function TermsPage() {
    return (
        <article className="card stack">
            <h1 className="h1">Conditions d’utilisation</h1>
            <p className="muted">Dernière mise à jour : {operator.updatedAt}</p>

            <Notice tone="warning" title="Projet de démonstration">
                {DEMO_NOTICE} N’y saisissez pas de données réelles de clients.
            </Notice>

            <h2>Éditeur</h2>
            <p>
                {operator.name}, {operator.status} ({operator.registration}). Directrice de la publication : {operator.publicationDirector}. Contact :{' '}
                <a href={`mailto:${operator.contact}`}>{operator.contact}</a>. Hébergeurs : voir les <Link href="/mentions-legales">mentions légales</Link>.
            </p>

            <h2>Objet</h2>
            <p>
                Fluxia est une démonstration d’un logiciel en ligne de gestion des interventions de maintenance (demandes, planning, rapports, devis,
                factures), présentée dans le cadre d’un portfolio. L’inscription crée un espace de test propre à l’entreprise, dont le premier compte est
                responsable.
            </p>

            <h2>Abonnement et paiement</h2>
            <p>
                L’abonnement présenté dans l’application est une simulation. Aucun paiement réel n’est demandé ni encaissé : le paiement en ligne est
                désactivé sur cette démonstration, et s’il venait à être activé, ce serait uniquement en mode test de Stripe (cartes de test, aucun
                débit). À la fin de la période d’essai simulée, l’espace reste consultable en lecture seule.
            </p>

            <h2>Disponibilité</h2>
            <p>
                Le service est fourni tel quel, sans garantie de disponibilité ni de conservation des données. Les fichiers déposés (photos, signatures,
                enregistrements audio) peuvent être perdus à chaque mise à jour du serveur de démonstration.
            </p>

            <h2>Responsabilités</h2>
            <p>
                Les propositions de l’assistant IA (analyses, rapports, devis) doivent être vérifiées par l’utilisateur : la validation humaine reste
                obligatoire dans le service. L’utilisateur est responsable des données qu’il saisit ; les documents produits par la démonstration n’ont
                aucune valeur commerciale ou comptable.
            </p>

            <h2>Données</h2>
            <p>
                Les données saisies peuvent être exportées et supprimées à tout moment depuis la page Paramètres. Voir la{' '}
                <Link href="/confidentialite">politique de confidentialité</Link>.
            </p>

            <h2>Droit applicable</h2>
            <p>Droit français.</p>
        </article>
    );
}
