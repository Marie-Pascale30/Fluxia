import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, QUOTE_STATUS, REPORT_STATUS } from '@/lib/format';

export const metadata = { title: 'Rapports' };

export default async function ReportsPage() {
    const reports = await api.reports.list();

    return (
        <>
            <PageHeader title="Rapports" subtitle="Générés depuis les comptes rendus des techniciens, validés puis envoyés au client." />
            <Card>
                {reports.length === 0 ? (
                    <EmptyState icon="▤" title="Aucun rapport" />
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Intervention</th>
                                <th>Client</th>
                                <th>Technicien</th>
                                <th>Date</th>
                                <th>Facturation</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <Link className="table-link" href={`/rapports/${r.id}`}>
                                            #{r.intervention.number} · {r.intervention.title}
                                        </Link>
                                    </td>
                                    <td>{r.intervention.client.name}</td>
                                    <td>{r.intervention.technician?.firstName ?? '—'}</td>
                                    <td>{formatDate(r.createdAt)}</td>
                                    <td>
                                        {r.quote ? (
                                            <Link href={`/devis/${r.quote.id}`}>
                                                <Badge label={`Devis ${r.quote.number} · ${QUOTE_STATUS[r.quote.status].label}`} />
                                            </Link>
                                        ) : r.billable ? (
                                            <Badge label="Facturable" tone="orange" />
                                        ) : (
                                            <span className="muted">Couvert</span>
                                        )}
                                    </td>
                                    <td>
                                        <Badge {...REPORT_STATUS[r.status]} />
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
