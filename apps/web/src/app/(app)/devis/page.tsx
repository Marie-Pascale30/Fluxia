import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney, QUOTE_STATUS } from '@/lib/format';
import type { QuoteStatus } from '@/lib/types';

export const metadata = { title: 'Devis' };

const VIEWS: { key: string; label: string; statuses: QuoteStatus[] | null }[] = [
    { key: 'todo', label: 'À valider', statuses: ['DRAFT', 'VALIDATED'] },
    { key: 'sent', label: 'En attente client', statuses: ['SENT'] },
    { key: 'closed', label: 'Décidés', statuses: ['ACCEPTED', 'REFUSED'] },
    { key: 'all', label: 'Tous', statuses: null },
];

export default async function QuotesPage({ searchParams }: PageProps<'/devis'>) {
    const raw = (await searchParams).view;
    const view = VIEWS.find((v) => v.key === raw) ?? VIEWS[0];
    const all = await api.quotes.list();
    const quotes = all.filter((q) => !view.statuses || view.statuses.includes(q.status));
    const pipeline = all.filter((q) => q.status === 'SENT').reduce((s, q) => s + q.totalHtCents, 0);

    return (
        <>
            <PageHeader
                title="Devis"
                subtitle="Les brouillons sont générés par l'IA, mais jamais envoyés sans validation."
                actions={pipeline > 0 && <span className="muted">En attente client : <b>{formatMoney(pipeline)} HT</b></span>}
            />
            <Tabs
                active={view.key}
                items={VIEWS.map((v) => ({
                    key: v.key,
                    label: `${v.label} · ${all.filter((q) => !v.statuses || v.statuses.includes(q.status)).length}`,
                    href: `/devis?view=${v.key}`,
                }))}
            />
            <Card>
                {quotes.length === 0 ? (
                    <EmptyState icon="€" title="Aucun devis dans cette vue">
                        Les devis se génèrent depuis un rapport facturable ou une demande de chiffrage de l&apos;Inbox.
                    </EmptyState>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>N°</th>
                                <th>Objet</th>
                                <th>Client</th>
                                <th>Origine</th>
                                <th>Date</th>
                                <th className="right">Total HT</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotes.map((q) => (
                                <tr key={q.id}>
                                    <td className="nowrap">
                                        <Link className="table-link" href={`/devis/${q.id}`}>
                                            {q.number}
                                        </Link>
                                    </td>
                                    <td>
                                        <Link className="table-link" href={`/devis/${q.id}`}>
                                            {q.title}
                                        </Link>
                                        {q.warnings.length > 0 && q.status === 'DRAFT' && (
                                            <div className="muted small">⚠ {q.warnings.length} point(s) à contrôler</div>
                                        )}
                                    </td>
                                    <td>{q.client.name}</td>
                                    <td className="small">
                                        {q.intervention ? `Intervention #${q.intervention.number}` : q.request ? 'Demande client' : '—'}
                                    </td>
                                    <td>{formatDate(q.createdAt)}</td>
                                    <td className="right nowrap">{formatMoney(q.totalHtCents)}</td>
                                    <td>
                                        <Badge {...QUOTE_STATUS[q.status]} />
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
