import Link from 'next/link';
import { cancelInvoice, deleteInvoice, issueInvoice, payInvoice, saveInvoice } from '@/app/actions';
import { ActivityTimeline, Badge, Card, KeyValue, Notice, PageHeader } from '@/components/ui';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActionForm } from '@/components/ui/ActionForm';
import { MessageList } from '@/components/ui/MessageList';
import { LinesEditor } from '@/features/documents/LinesEditor';
import { api } from '@/lib/api';
import { orNotFound } from '@/lib/data';
import { dayKey, formatDate, formatMoney, INVOICE_STATUS, LINE_KIND, PAYMENT_METHOD } from '@/lib/format';

export default async function InvoicePage({ params }: PageProps<'/factures/[id]'>) {
    const { id } = await params;
    const [invoice, catalog] = await Promise.all([orNotFound(api.invoices.get(id)), api.catalog()]);
    const i = invoice;
    const draft = i.status === 'DRAFT';

    return (
        <>
            <PageHeader
                title={i.number ? `Facture ${i.number}` : 'Facture brouillon'}
                subtitle={`${i.client.name} · ${i.title}`}
                actions={
                    <>
                        <a className="btn light sm" href={`/pdf/facture/${i.id}`} target="_blank" rel="noreferrer">
                            PDF
                        </a>
                        {i.overdue ? <Badge label="En retard" tone="red" /> : <Badge {...INVOICE_STATUS[i.status]} />}
                    </>
                }
            />

            <div className="main-aside">
                <div className="stack">
                    {draft && (
                        <Notice tone="warning" title="Brouillon">
                            Le numéro définitif sera attribué à l&apos;émission. Une fois émise, la facture ne pourra plus être modifiée.
                        </Notice>
                    )}
                    {i.status === 'CANCELLED' && (
                        <Notice tone="danger" title={`Annulée par l'avoir ${i.creditNoteNumber}`}>
                            {i.cancelReason}
                        </Notice>
                    )}
                    <Card title={draft ? 'Lignes' : 'Détail'}>
                        {draft ? (
                            <LinesEditor
                                document={i}
                                catalog={catalog}
                                save={saveInvoice.bind(null, i.id)}
                                validate={issueInvoice.bind(null, i.id)}
                                validateLabel="Émettre la facture"
                                dirtyValidateLabel="Enregistrer et émettre"
                            />
                        ) : (
                            <table className="table">
                                <tbody>
                                    {i.lines.map((l) => (
                                        <tr key={l.id}>
                                            <td>
                                                {l.label}
                                                <div className="muted small">{LINE_KIND[l.kind]}</div>
                                            </td>
                                            <td className="right nowrap">
                                                {l.quantity} × {formatMoney(l.unitPriceCents)}
                                            </td>
                                            <td className="right nowrap">{formatMoney(Math.round(l.quantity * l.unitPriceCents))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={2} className="right">
                                            Total HT · TVA
                                        </td>
                                        <td className="right nowrap">
                                            {formatMoney(i.totalHtCents)} · {formatMoney(i.vatCents)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} className="right">
                                            Net à payer TTC
                                        </td>
                                        <td className="right nowrap">{formatMoney(i.totalTtcCents)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </Card>
                </div>

                <div className="stack">
                    <Card>
                        <KeyValue
                            items={[
                                ['Client', <Link key="c" href={`/clients/${i.client.id}`}>{i.client.name}</Link>],
                                ['Origine', i.quote ? <Link key="q" href={`/devis/${i.quote.id}`}>Devis {i.quote.number}</Link> : i.intervention ? <Link key="i" href={`/interventions/${i.intervention.id}`}>Intervention n°{i.intervention.number}</Link> : '—'],
                                ['Émise le', i.issuedAt ? formatDate(i.issuedAt) : '—'],
                                ['Échéance', i.dueAt ? formatDate(i.dueAt) : '—'],
                                ['Total TTC', <b key="t">{formatMoney(i.totalTtcCents)}</b>],
                                ['Règlement', i.paidAt ? `${formatDate(i.paidAt)} · ${i.paymentMethod ? PAYMENT_METHOD[i.paymentMethod] : ''}` : '—'],
                            ]}
                        />
                        {draft && (
                            <div className="actions">
                                <ActionButton action={deleteInvoice.bind(null, i.id)} variant="danger" confirm="Supprimer ce brouillon ?">
                                    Supprimer le brouillon
                                </ActionButton>
                            </div>
                        )}
                    </Card>

                    {i.status === 'ISSUED' && (
                        <Card title="Enregistrer le règlement">
                            <ActionForm action={payInvoice.bind(null, i.id)} submitLabel="Marquer comme payée" variant="green">
                                <div className="form-row">
                                    <label>
                                        Mode
                                        <select name="method" className="select" defaultValue="TRANSFER">
                                            {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Date
                                        <input type="date" name="paidAt" className="input" defaultValue={dayKey()} />
                                    </label>
                                </div>
                            </ActionForm>
                            <details className="mt">
                                <summary>Annuler par un avoir</summary>
                                <div className="mt">
                                    <ActionForm action={cancelInvoice.bind(null, i.id)} submitLabel="Émettre l'avoir" variant="light">
                                        <label>
                                            Motif
                                            <input name="reason" className="input" required minLength={3} placeholder="Erreur de quantité, geste commercial…" />
                                        </label>
                                    </ActionForm>
                                </div>
                            </details>
                        </Card>
                    )}

                    <Card title="Historique">
                        <ActivityTimeline items={i.timeline} />
                        {i.messages.length > 0 && (
                            <div className="mt">
                                <MessageList messages={i.messages} />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
