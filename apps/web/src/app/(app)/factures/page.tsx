import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { dayKey, formatDate, formatMoney, INVOICE_STATUS } from '@/lib/format';
import type { Invoice } from '@/lib/types';

export const metadata = { title: 'Factures' };

const VIEWS: { key: string; label: string; filter: (i: Invoice) => boolean }[] = [
    { key: 'draft', label: 'Brouillons', filter: (i) => i.status === 'DRAFT' },
    { key: 'issued', label: 'À encaisser', filter: (i) => i.status === 'ISSUED' },
    { key: 'overdue', label: 'En retard', filter: (i) => i.overdue },
    { key: 'paid', label: 'Payées', filter: (i) => i.status === 'PAID' },
    { key: 'all', label: 'Toutes', filter: () => true },
];

export default async function InvoicesPage({ searchParams }: PageProps<'/factures'>) {
    const raw = (await searchParams).view;
    const all = await api.invoices.list();
    const view = VIEWS.find((v) => v.key === raw) ?? (all.some((i) => i.status === 'DRAFT') ? VIEWS[0] : VIEWS[1]);
    const invoices = all.filter(view.filter);
    const outstanding = all.filter((i) => i.status === 'ISSUED').reduce((s, i) => s + i.totalTtcCents, 0);

    const today = dayKey();
    const firstOfMonth = `${today.slice(0, 8)}01`;

    return (
        <>
            <PageHeader
                title="Factures"
                subtitle="Numérotation continue à l'émission ; une facture émise s'annule par un avoir."
                actions={outstanding > 0 && <span className="muted">À encaisser : <b>{formatMoney(outstanding)} TTC</b></span>}
            />
            <Tabs
                active={view.key}
                items={VIEWS.map((v) => ({ key: v.key, label: `${v.label} · ${all.filter(v.filter).length}`, href: `/factures?view=${v.key}` }))}
            />
            <Card className="mb">
                {invoices.length === 0 ? (
                    <EmptyState icon="§" title="Aucune facture dans cette vue">
                        Les factures se créent depuis un devis accepté ou un rapport facturable.
                    </EmptyState>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>N°</th>
                                <th>Objet</th>
                                <th>Client</th>
                                <th>Émise le</th>
                                <th>Échéance</th>
                                <th className="right">Total TTC</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((i) => (
                                <tr key={i.id}>
                                    <td className="nowrap">
                                        <Link className="table-link" href={`/factures/${i.id}`}>
                                            {i.number ?? 'Brouillon'}
                                        </Link>
                                    </td>
                                    <td>
                                        <Link className="table-link" href={`/factures/${i.id}`}>
                                            {i.title}
                                        </Link>
                                    </td>
                                    <td>{i.client.name}</td>
                                    <td>{i.issuedAt ? formatDate(i.issuedAt) : '—'}</td>
                                    <td className={i.overdue ? 'form-error' : undefined}>{i.dueAt ? formatDate(i.dueAt) : '—'}</td>
                                    <td className="right nowrap">{formatMoney(i.totalTtcCents)}</td>
                                    <td>{i.overdue ? <Badge label="En retard" tone="red" /> : <Badge {...INVOICE_STATUS[i.status]} />}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            <Card title="Export comptable">
                <p className="muted" style={{ marginTop: 0 }}>
                    Journal des ventes (factures émises et avoirs) au format CSV, importable dans la plupart des logiciels comptables : compte client 411,
                    produits 706, TVA collectée 44571.
                </p>
                <form className="row-flex" action="/export/ventes" method="get">
                    <label className="row-flex small">
                        Du <input type="date" name="from" className="input" defaultValue={firstOfMonth} required />
                    </label>
                    <label className="row-flex small">
                        au <input type="date" name="to" className="input" defaultValue={today} required />
                    </label>
                    <button className="btn light">Télécharger le CSV</button>
                </form>
            </Card>
        </>
    );
}
