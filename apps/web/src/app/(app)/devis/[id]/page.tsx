import Link from 'next/link';
import { quoteTransition } from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActivityTimeline, Badge, Card, KeyValue, Notice, PageHeader } from '@/components/ui';
import { MessageList } from '@/components/ui/MessageList';
import { QuoteEditor } from '@/features/quotes/QuoteEditor';
import { api } from '@/lib/api';
import { orNotFound } from '@/lib/data';
import { formatDate, formatDateTime, formatMoney, LINE_KIND, QUOTE_STATUS } from '@/lib/format';

export default async function QuotePage({ params }: PageProps<'/devis/[id]'>) {
    const { id } = await params;
    const [quote, catalog] = await Promise.all([orNotFound(api.quotes.get(id)), api.catalog()]);
    const q = quote;
    const draft = q.status === 'DRAFT';
    const missingPrices = q.lines.some((l) => l.unitPriceCents === 0);

    return (
        <>
            <PageHeader
                title={`Devis ${q.number}`}
                subtitle={`${q.client.name} · créé le ${formatDate(q.createdAt)}`}
                actions={
                    <>
                        <a className="btn light sm" href={`/pdf/devis/${q.id}`} target="_blank" rel="noreferrer">
                            PDF
                        </a>
                        <Badge {...QUOTE_STATUS[q.status]} />
                    </>
                }
            />

            <div className="main-aside">
                <div className="stack">
                    {draft && (q.warnings.length > 0 || missingPrices) && (
                        <Notice tone="warning" title="À contrôler avant validation">
                            <ul>
                                {q.warnings.map((w) => (
                                    <li key={w}>{w}</li>
                                ))}
                                {missingPrices && <li>Certaines lignes n&apos;ont pas de prix.</li>}
                            </ul>
                        </Notice>
                    )}

                    <Card title={draft ? 'Brouillon' : q.title}>
                        {draft ? (
                            <QuoteEditor quote={q} catalog={catalog} />
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Désignation</th>
                                        <th className="right">Qté</th>
                                        <th className="right">PU HT</th>
                                        <th className="right">Total HT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {q.lines.map((l) => (
                                        <tr key={l.id}>
                                            <td>
                                                {l.label}
                                                <div className="muted small">{LINE_KIND[l.kind]}</div>
                                            </td>
                                            <td className="right">{l.quantity}</td>
                                            <td className="right nowrap">{formatMoney(l.unitPriceCents)}</td>
                                            <td className="right nowrap">{formatMoney(Math.round(l.quantity * l.unitPriceCents))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} className="right">
                                            Total HT
                                        </td>
                                        <td className="right nowrap">{formatMoney(q.totalHtCents)}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} className="right muted">
                                            TVA {Math.round(q.vatRate * 100)} %
                                        </td>
                                        <td className="right nowrap muted">{formatMoney(q.vatCents)}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} className="right">
                                            Total TTC
                                        </td>
                                        <td className="right nowrap">{formatMoney(q.totalTtcCents)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                        {!draft && q.notes && <p className="muted">{q.notes}</p>}
                    </Card>
                </div>

                <div className="stack">
                    <Card>
                        <KeyValue
                            items={[
                                ['Client', <Link key="c" href={`/clients/${q.client.id}`}>{q.client.name}</Link>],
                                ['Destinataire', q.client.email ?? '—'],
                                [
                                    'Origine',
                                    q.intervention ? (
                                        <Link key="i" href={`/interventions/${q.intervention.id}`}>Intervention #{q.intervention.number}</Link>
                                    ) : q.request ? (
                                        <Link key="r" href={`/inbox/${q.request.id}`}>Demande « {q.request.subject} »</Link>
                                    ) : (
                                        '—'
                                    ),
                                ],
                                ['Total HT', <b key="t">{formatMoney(q.totalHtCents)}</b>],
                                ['Total TTC', formatMoney(q.totalTtcCents)],
                                ['Validé le', q.validatedAt ? formatDateTime(q.validatedAt) : '—'],
                                ['Envoyé le', q.sentAt ? formatDateTime(q.sentAt) : '—'],
                            ]}
                        />
                        <div className="actions">
                            {q.status === 'VALIDATED' && (
                                <>
                                    <ActionButton action={quoteTransition.bind(null, id, 'send')} variant="green" confirm={`Envoyer le devis à ${q.client.email ?? 'ce client'} ?`}>
                                        Envoyer au client
                                    </ActionButton>
                                    <ActionButton action={quoteTransition.bind(null, id, 'reopen')} variant="light">
                                        Modifier
                                    </ActionButton>
                                </>
                            )}
                            {q.status === 'SENT' && (
                                <>
                                    <ActionButton action={quoteTransition.bind(null, id, 'accept')} variant="green">
                                        Accepté par le client
                                    </ActionButton>
                                    <ActionButton action={quoteTransition.bind(null, id, 'refuse')} variant="danger">
                                        Refusé
                                    </ActionButton>
                                </>
                            )}
                        </div>
                        {draft && <p className="muted small">Validez le devis depuis l&apos;éditeur. Un devis n&apos;est jamais envoyé sans validation.</p>}
                    </Card>

                    <Card title="Historique">
                        <ActivityTimeline items={q.timeline} />
                        {q.messages.length > 0 && (
                            <div className="mt">
                                <MessageList messages={q.messages} />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
