import { operator } from '@/lib/legal';

export const metadata = { title: 'Politique de confidentialité' };

export default function PrivacyPage() {
    return (
        <article className="card stack">
            <h1 className="h1">Politique de confidentialité</h1>
            <p className="muted">Dernière mise à jour : {operator.updatedAt}</p>

            <h2>Qui traite vos données ?</h2>
            <p>
                {operator.name}, {operator.address} ({operator.registration}), exploite la plateforme Fluxia. Contact pour toute question relative à vos
                données : {operator.contact}.
            </p>
            <p>
                Chaque entreprise utilisatrice reste <b>responsable du traitement</b> des données de ses propres clients (fiches clients, demandes,
                interventions, documents). Pour ces données, {operator.name} agit en tant que <b>sous-traitant</b> au sens de l’article 28 du RGPD et ne
                les utilise que pour fournir le service.
            </p>

            <h2>Quelles données ?</h2>
            <ul>
                <li>Comptes utilisateurs : nom, email professionnel, rôle, mot de passe (stocké sous forme d’empreinte, jamais en clair), dates de connexion.</li>
                <li>Données de l’entreprise : coordonnées, mentions légales, réglages de facturation.</li>
                <li>Données saisies dans le service : clients, sites, équipements, demandes reçues, interventions, photos, signatures, enregistrements audio, rapports, devis, factures, messages envoyés.</li>
                <li>Journal technique : actions effectuées (traçabilité), pour la sécurité et le support.</li>
            </ul>

            <h2>Pourquoi ?</h2>
            <p>
                Fournir le service souscrit (exécution du contrat), assurer sa sécurité (intérêt légitime) et respecter les obligations légales, notamment
                comptables et fiscales.
            </p>

            <h2>Qui y a accès ?</h2>
            <p>
                Les données d’une entreprise ne sont accessibles qu’à ses propres utilisateurs, selon leur rôle. Elles sont cloisonnées techniquement des
                données des autres entreprises. Prestataires techniques intervenant pour le service (sous-traitants ultérieurs) :
            </p>
            <ul>
                <li>Hébergement : {operator.host}.</li>
                <li>Envoi des emails et SMS : prestataire configuré par l’exploitant (ex. fournisseur SMTP, Twilio).</li>
                <li>Assistance IA (si activée) : Anthropic, pour l’analyse des demandes et la rédaction des rapports.</li>
                <li>Paiement de l’abonnement : Stripe (les données de carte ne transitent jamais par Fluxia).</li>
            </ul>
            <p>Certains prestataires peuvent traiter des données hors de l’Union européenne ; ils sont alors encadrés par des clauses contractuelles types.</p>

            <h2>Combien de temps ?</h2>
            <p>
                Pendant toute la durée de l’abonnement, puis jusqu’à la suppression de l’entreprise. Les factures et pièces comptables doivent être conservées
                10 ans par l’entreprise utilisatrice : exportez-les avant toute suppression.
            </p>

            <h2>Vos droits</h2>
            <p>
                Accès, rectification, effacement, limitation, opposition et portabilité. Le responsable d’une entreprise peut exporter toutes ses données et
                supprimer définitivement l’entreprise depuis la page Paramètres. Pour toute autre demande : {operator.contact}. Vous pouvez aussi saisir la
                CNIL (www.cnil.fr).
            </p>

            <h2>Sécurité</h2>
            <p>
                Connexions chiffrées (HTTPS), mots de passe hachés, sessions limitées dans le temps et fermées à chaque changement de mot de passe, cloisonnement
                des données par entreprise, sauvegardes régulières.
            </p>

            <h2>Cookies</h2>
            <p>Fluxia n’utilise qu’un cookie strictement nécessaire : celui de la session de connexion. Aucun cookie publicitaire ni de mesure d’audience.</p>
        </article>
    );
}
