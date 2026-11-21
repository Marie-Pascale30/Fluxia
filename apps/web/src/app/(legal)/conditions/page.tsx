import Link from 'next/link';
import { operator } from '@/lib/legal';

export const metadata = { title: 'Conditions d’utilisation' };

export default function TermsPage() {
    return (
        <article className="card stack">
            <h1 className="h1">Conditions d’utilisation</h1>
            <p className="muted">Dernière mise à jour : {operator.updatedAt}</p>

            <h2>Éditeur</h2>
            <p>
                {operator.name}, {operator.address} ({operator.registration}). Directeur de la publication : {operator.publicationDirector}. Contact :{' '}
                {operator.contact}. Hébergeur : {operator.host}.
            </p>

            <h2>Objet</h2>
            <p>
                Fluxia est un logiciel en ligne de gestion des interventions de maintenance (demandes, planning, rapports, devis, factures), réservé aux
                professionnels. L’inscription crée un espace propre à l’entreprise, dont le premier compte est responsable.
            </p>

            <h2>Abonnement</h2>
            <p>
                Une période d’essai gratuite est proposée à l’inscription. Au-delà, l’utilisation suppose un abonnement payant, résiliable à tout moment depuis
                la page Abonnement ; la résiliation prend effet à la fin de la période en cours. Sans abonnement actif, l’espace reste consultable mais ne
                permet plus de créer ni de modifier des données.
            </p>

            <h2>Responsabilités</h2>
            <p>
                Les propositions de l’assistant IA (analyses, rapports, devis) doivent être vérifiées par l’utilisateur avant envoi : la validation humaine
                reste obligatoire dans le service. L’entreprise utilisatrice est responsable des données qu’elle saisit et de leur licéité, ainsi que de la
                conformité de ses documents commerciaux et comptables.
            </p>

            <h2>Données</h2>
            <p>
                Les données restent la propriété de l’entreprise utilisatrice, qui peut les exporter et les supprimer à tout moment. Voir la{' '}
                <Link href="/confidentialite">politique de confidentialité</Link>.
            </p>

            <h2>Droit applicable</h2>
            <p>Droit français. À défaut d’accord amiable, les tribunaux compétents sont ceux du siège de l’éditeur.</p>
        </article>
    );
}
