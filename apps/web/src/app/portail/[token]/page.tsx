import { notFound } from 'next/navigation';
import { Badge, Card, EmptyState } from '@/components/ui';
import { QuoteDecision } from '@/features/portal/QuoteDecision';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatMoney, formatSlot, INTERVENTION_STATUS, QUOTE_STATUS } from '@/lib/format';

export const metadata = { title: 'Espace client', robots: { index: false, follow: false } };

const COMPANY = process.env.COMPANY_NAME ?? 'Fluxia Maintenance';

/** Espace client public : accès par lien signé, sans compte. */
export default async function PortalPage({ params }: PageProps<'/portail/[token]'>) {
    const { token } = await params;
    const summary = await api.portal.summary(token).catch((error) => {
        if (error instanceof ApiError && error.status === 404) notFound();
        throw error;
    });

    const upcoming = summary.interventions.filter((i) => ['TO_SCHEDULE', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS'].includes(i.status));
    const past = summary.interventions.filter((i) => !upcoming.includes(i));
    const pending = summary.quotes.filter((q) => q.status === 'SENT');
    const pdf = (kind: 'rapport' | 'devis', id: string) => `/portail/${token}/pdf/${kind}/${id}`;

    return (
        <div className="portal">
            <header className="portal-head">
                <div className="auth-brand">{COMPANY}</div>
                <div className="muted">Espace client · {summary.client.name}</div>
            </header>

            <main className="portal-main stack">
                <h1 className="h1">Bonjour{summary.client.contactName ? ` ${summary.client.contactName}` : ''},</h1>

                {pending.length > 0 && (
                    <Card title={`Devis en attente de votre réponse (${pending.length})`}>
                        {pending.map((q) => (
                            <div key={q.id} className="portal-quote">
                                <div className="row-flex">
                                    <b className="grow">
                                        {q.number} · {q.title}
                                    </b>
                                    <b>{formatMoney(q.totalTtcCents)} TTC</b>
                                </div>
                                <table className="table mt">
                                    <tbody>
                                        {q.lines.map((l, i) => (
                                            <tr key={i}>
                                                <td>{l.label}</td>
                                                <td className="right nowrap">
                                                    {l.quantity} × {formatMoney(l.unitPriceCents)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td className="right">Total HT · TVA</td>
                                            <td className="right nowrap">
                                                {formatMoney(q.totalHtCents)} · {formatMoney(q.vatCents)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                                <div className="actions">
                                    <a className="btn light sm" href={pdf('devis', q.id)} target="_blank" rel="noreferrer">
                                        Voir le devis (PDF)
                                    </a>
                                </div>
                                <QuoteDecision token={token} quoteId={q.id} defaultName={summary.client.contactName ?? ''} />
                            </div>
                        ))}
                    </Card>
                )}

                <Card title="Interventions en cours">
                    {upcoming.length === 0 && <div className="muted">Aucune intervention en cours.</div>}
                    {upcoming.map((i) => (
                        <div key={i.id} className="row">
                            <div className="row-main">
                                <div className="row-title">
                                    {i.title} <span className="muted small">n°{i.number}</span>
                                </div>
                                <div className="muted">
                                    {i.scheduledStart ? formatSlot(i.scheduledStart, i.scheduledEnd) : 'Date à confirmer'}
                                    {i.technician && ` · ${i.technician}`} · {i.site}
                                </div>
                            </div>
                            <Badge {...INTERVENTION_STATUS[i.status]} />
                        </div>
                    ))}
                </Card>

                <Card title="Historique et documents">
                    {past.length === 0 && summary.quotes.length === pending.length && <EmptyState icon="▤" title="Aucun document pour l'instant" />}
                    {past.map((i) => (
                        <div key={i.id} className="row">
                            <div className="row-main">
                                <div className="row-title">{i.title}</div>
                                <div className="muted">{i.scheduledStart ? formatDate(i.scheduledStart) : '—'} · {i.site}</div>
                            </div>
                            {i.reportId ? (
                                <a className="btn light sm" href={pdf('rapport', i.reportId)} target="_blank" rel="noreferrer">
                                    Rapport (PDF)
                                </a>
                            ) : (
                                <Badge {...INTERVENTION_STATUS[i.status]} />
                            )}
                        </div>
                    ))}
                    {summary.quotes
                        .filter((q) => q.status !== 'SENT')
                        .map((q) => (
                            <div key={q.id} className="row">
                                <div className="row-main">
                                    <div className="row-title">
                                        Devis {q.number} · {q.title}
                                    </div>
                                    <div className="muted">
                                        {formatMoney(q.totalTtcCents)} TTC
                                        {q.decidedAt && ` · réponse du ${formatDate(q.decidedAt)}${q.decisionBy ? ` (${q.decisionBy})` : ''}`}
                                    </div>
                                </div>
                                <Badge {...QUOTE_STATUS[q.status]} />
                                <a className="btn light sm" href={pdf('devis', q.id)} target="_blank" rel="noreferrer">
                                    PDF
                                </a>
                            </div>
                        ))}
                </Card>

                <p className="muted small">Ce lien est personnel : ne le partagez pas. En cas de doute, demandez-nous un nouveau lien.</p>
            </main>
        </div>
    );
}
