import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Clients' };

export default async function ClientsPage({ searchParams }: PageProps<'/clients'>) {
    const raw = (await searchParams).q;
    const q = typeof raw === 'string' ? raw : '';
    const clients = await api.clients.list(q || undefined);

    return (
        <>
            <PageHeader
                title="Clients"
                subtitle="L'historique de chaque client devient directement exploitable par l'IA."
                actions={
                    <Link href="/clients/nouveau" className="btn">
                        + Nouveau client
                    </Link>
                }
            />
            <form className="row-flex mb" action="/clients">
                <input name="q" className="input" style={{ maxWidth: 320 }} placeholder="Rechercher un client…" defaultValue={q} />
                <button className="btn light">Rechercher</button>
                {q && (
                    <Link href="/clients" className="muted small">
                        Effacer
                    </Link>
                )}
            </form>
            <Card>
                {clients.length === 0 ? (
                    <EmptyState icon="⌂" title="Aucun client trouvé" />
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Contrat</th>
                                <th>Sites</th>
                                <th>Équipements</th>
                                <th>Interventions</th>
                                <th>Dernière</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((c) => (
                                <tr key={c.id}>
                                    <td>
                                        <Link className="table-link" href={`/clients/${c.id}`}>
                                            {c.name}
                                        </Link>
                                        <div className="muted small">{c.email ?? '—'}</div>
                                    </td>
                                    <td>{c.activeContract ? <Badge label="Actif" tone="green" /> : <Badge label="Aucun" />}</td>
                                    <td>{c.siteCount}</td>
                                    <td>{c.equipmentCount}</td>
                                    <td>{c.interventionCount}</td>
                                    <td className="small">
                                        {c.lastIntervention ? `#${c.lastIntervention.number} · ${formatDate(c.lastIntervention.createdAt)}` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </>
    );
}
