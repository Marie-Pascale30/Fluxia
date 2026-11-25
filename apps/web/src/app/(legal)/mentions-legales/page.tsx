import Link from 'next/link';
import { Notice } from '@/components/ui';
import { DEMO_NOTICE, hosts, operator } from '@/lib/legal';

export const metadata = { title: 'Mentions légales' };

export default function LegalNoticePage() {
    return (
        <article className="card stack">
            <h1 className="h1">Mentions légales</h1>
            <p className="muted">Dernière mise à jour : {operator.updatedAt}</p>

            <Notice tone="warning" title="Projet de démonstration">{DEMO_NOTICE}</Notice>

            <h2>Éditeur</h2>
            <p>
                {operator.name}, {operator.status}.
                <br />
                Immatriculation : {operator.registration}.
                <br />
                Contact : <a href={`mailto:${operator.contact}`}>{operator.contact}</a>
            </p>

            <h2>Directrice de la publication</h2>
            <p>{operator.publicationDirector}</p>

            <h2>Hébergement</h2>
            <ul>
                {hosts.map((h) => (
                    <li key={h.name}>
                        {h.role} : <b>{h.name}</b>, {h.address} ({h.site})
                    </li>
                ))}
            </ul>

            <h2>Propriété intellectuelle</h2>
            <p>
                Le code et les contenus de Fluxia sont la propriété de leur autrice. Les données de démonstration (entreprises, clients, techniciens,
                interventions) sont fictives.
            </p>

            <h2>Données personnelles</h2>
            <p>
                Voir la <Link href="/confidentialite">politique de confidentialité</Link> et les <Link href="/conditions">conditions d’utilisation</Link>.
            </p>
        </article>
    );
}
