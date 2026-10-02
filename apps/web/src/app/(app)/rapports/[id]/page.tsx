import Link from 'next/link';
import { quoteFromReport, reopenReport, sendReport, validateReport } from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActivityTimeline, Badge, Card, Notice, PageHeader } from '@/components/ui';
import { ReportEditor } from '@/features/reports/ReportEditor';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { orNotFound } from '@/lib/data';
import { formatDate, formatMoney, LINE_KIND, providerLabel, QUOTE_STATUS, REPORT_STATUS } from '@/lib/format';

export default async function ReportPage({ params }: PageProps<'/rapports/[id]'>) {
    const { id } = await params;
    const user = await getCurrentUser();
    const manager = user.role === 'MANAGER';
    const [report, catalog] = await Promise.all([orNotFound(api.reports.get(id)), manager ? api.catalog() : []]);
    const { intervention: i, billing } = report;
    const billableTotal = billing.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);

    return (
        <>
            <PageHeader
                title={`Rapport #${i.number}`}
                subtitle={`Généré à partir du compte rendu de ${i.technician?.firstName ?? 'technicien'} · ${providerLabel(report.aiProvider)}`}
                actions={<Badge {...REPORT_STATUS[report.status]} />}
            />

            <div className="two">
                <div className="stack">
                    <article className="doc">
                        <h2>Rapport d&apos;intervention</h2>
                        <div className="muted">
                            {i.client.name} · {formatDate(report.createdAt)} · {i.technician ? `${i.technician.firstName} ${i.technician.lastName}` : '—'}
                        </div>
                        <div className="muted small">
                            {i.site.address}, {i.site.postalCode} {i.site.city}
                            {i.equipment && ` · ${i.equipment.label}`}
                        </div>
                        <hr />
                        <b>Motif</b>
                        <p>{report.reason}</p>
                        <b>Diagnostic</b>
                        <p>{report.diagnosis}</p>
                        <b>Travaux réalisés</b>
                        <p>{report.workDone}</p>
                        {report.parts.length > 0 && (
                            <>
                                <b>Pièces fournies</b>
                                <p>{report.parts.map((p) => `${p.quantity} × ${p.label}`).join(', ')}</p>
                            </>
                        )}
                        <b>Résultat</b>
                        <p>{report.result}</p>
                        {report.recommendation && (
                            <>
                                <b>Recommandation</b>
                                <p>{report.recommendation}</p>
                            </>
                        )}
                    </article>

                    <details className="card">
                        <summary>Compte rendu original du technicien</summary>
                        <div className="email-body mt">{report.voiceNote}</div>
                    </details>

                    {manager && report.status === 'DRAFT' && (
                        <Card title="Corriger le brouillon">
                            <ReportEditor report={report} catalog={catalog} />
                        </Card>
                    )}
                </div>

                <div className="stack">
                    <Card>
                        {billing.billable ? (
                            <>
                                <Badge label="Prestation facturable" tone="orange" />
                                <h2>Suite détectée</h2>
                                <Notice tone="warning" title="⚠ Hors forfait">
                                    {billing.notes}
                                </Notice>
                                <table className="table">
                                    <tbody>
                                        {billing.lines.map((l, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    {l.label}
                                                    <div className="muted small">{LINE_KIND[l.kind]}</div>
                                                </td>
                                                <td className="right nowrap">
                                                    {l.quantity} × {formatMoney(l.unitPriceCents)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td>Estimation HT</td>
                                            <td className="right">{formatMoney(billableTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </>
                        ) : (
                            <>
                                <Badge label="Rapport prêt" tone="green" />
                                <h2>Aucune facturation</h2>
                                <Notice tone="success">{billing.notes}</Notice>
                            </>
                        )}

                        {manager && report.quote && (
                            <Notice tone="success" title="Devis préparé">
                                <Link href={`/devis/${report.quote.id}`}>Devis {report.quote.number}</Link> — {QUOTE_STATUS[report.quote.status].label}
                            </Notice>
                        )}

                        {manager && (
                        <div className="actions">
                            {billing.billable && !report.quote && (
                                <ActionButton action={quoteFromReport.bind(null, id)} variant="ai" pendingLabel="Génération…">
                                    ✨ Générer le brouillon de devis
                                </ActionButton>
                            )}
                            {report.status === 'DRAFT' && (
                                <ActionButton action={validateReport.bind(null, id)} variant="green">
                                    Valider le rapport
                                </ActionButton>
                            )}
                            {report.status === 'VALIDATED' && (
                                <>
                                    <ActionButton action={sendReport.bind(null, id)} variant="green" confirm="Envoyer le rapport au client ?">
                                        Envoyer au client
                                    </ActionButton>
                                    <ActionButton action={reopenReport.bind(null, id)} variant="light">
                                        Modifier
                                    </ActionButton>
                                </>
                            )}
                            <Link href={`/interventions/${i.id}`} className="btn light">
                                Voir l&apos;intervention
                            </Link>
                        </div>
                        )}
                        {!manager && (
                            <div className="actions">
                                <Link href={`/techniciens/${user.technicianId}`} className="btn light">
                                    ← Mes missions
                                </Link>
                            </div>
                        )}
                        {manager && report.status === 'DRAFT' && (
                            <p className="muted small">Le rapport doit être validé avant d&apos;être envoyé au client.</p>
                        )}
                    </Card>

                    <Card title="Historique">
                        <ActivityTimeline items={report.timeline} />
                    </Card>
                </div>
            </div>
        </>
    );
}
