import Link from 'next/link';
import { dispatchMission, unassignIntervention } from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActivityTimeline, Badge, Card, Field, KeyValue, Notice, PageHeader, Stepper } from '@/components/ui';
import { MessageList } from '@/components/ui/MessageList';
import { CancelForm } from '@/features/interventions/CancelForm';
import { ManualAssignForm } from '@/features/interventions/ManualAssignForm';
import { Recommendations } from '@/features/interventions/Recommendations';
import { interventionSteps } from '@/features/interventions/steps';
import { api } from '@/lib/api';
import { orNotFound } from '@/lib/data';
import {
    dayKey,
    EQUIPMENT,
    formatDateTime,
    formatDuration,
    formatSlot,
    INTERVENTION_STATUS,
    INTERVENTION_TYPE,
    PRIORITY,
    QUOTE_STATUS,
    REPORT_STATUS,
    toLocalInput,
} from '@/lib/format';

export default async function InterventionPage({ params }: PageProps<'/interventions/[id]'>) {
    const { id } = await params;
    const intervention = await orNotFound(api.interventions.get(id));
    const i = intervention;

    const planning = ['TO_SCHEDULE', 'SCHEDULED', 'DISPATCHED'].includes(i.status);
    const [recommendations, technicians] = planning
        ? await Promise.all([api.interventions.recommendations(id), api.technicians.list()])
        : [[], []];

    const coverage = i.coverage.active
        ? `${i.coverage.reference} — MO ${i.coverage.coversLabor ? '✓' : '✕'} · pièces ${i.coverage.coversParts ? '✓' : '✕'} · déplacement ${i.coverage.coversTravel ? '✓' : '✕'}`
        : 'Aucun contrat actif';

    return (
        <>
            <PageHeader
                title={`Intervention #${i.number}`}
                subtitle={`${i.client.name} · ${i.title}`}
                actions={<Badge {...INTERVENTION_STATUS[i.status]} />}
            />
            {i.status !== 'CANCELLED' && <Stepper steps={interventionSteps(i)} />}
            {i.status === 'CANCELLED' && <Notice tone="danger" title="Intervention annulée">{i.cancelledReason}</Notice>}

            <div className="two">
                <div className="stack">
                    <Card>
                        <div className="row-flex">
                            <Badge {...PRIORITY[i.priority]} />
                            <Badge label={INTERVENTION_TYPE[i.type]} />
                        </div>
                        <h2>Détails</h2>
                        <KeyValue
                            items={[
                                ['Client', <Link key="c" href={`/clients/${i.client.id}`}>{i.client.name}</Link>],
                                ['Adresse', `${i.site.address}, ${i.site.postalCode} ${i.site.city}`],
                                ['Équipement', i.equipment ? `${i.equipment.label} (${EQUIPMENT[i.equipment.type]})` : '—'],
                                ['Problème', i.description],
                                ['Durée estimée', formatDuration(i.estimatedMinutes)],
                                ['Créneau', i.scheduledStart ? formatSlot(i.scheduledStart, i.scheduledEnd) : 'À planifier'],
                                ['Technicien', i.technician ? <Link key="t" href={`/techniciens/${i.technician.id}`}>{i.technician.firstName} {i.technician.lastName}</Link> : 'À affecter'],
                                ['Contrat', coverage],
                                ['Origine', i.request ? <Link key="r" href={`/inbox/${i.request.id}`}>Demande de {i.request.fromName}</Link> : 'Saisie manuelle'],
                            ]}
                        />
                        {i.initialDiagnosis && <Field label="Diagnostic initial IA">{i.initialDiagnosis}</Field>}

                        <div className="actions">
                            {i.status === 'SCHEDULED' && (
                                <ActionButton action={dispatchMission.bind(null, id)} variant="green" pendingLabel="Envoi…">
                                    Envoyer la mission à {i.technician?.firstName}
                                </ActionButton>
                            )}
                            {(i.status === 'DISPATCHED' || i.status === 'IN_PROGRESS') && i.technician && (
                                <Link href={`/techniciens/${i.technician.id}${i.scheduledStart ? `?date=${dayKey(i.scheduledStart)}` : ''}`} className="btn ai">
                                    Ouvrir la vue technicien →
                                </Link>
                            )}
                            {(i.status === 'SCHEDULED' || i.status === 'DISPATCHED') && (
                                <ActionButton action={unassignIntervention.bind(null, id)} variant="light" confirm="Retirer le technicien et replanifier ?">
                                    Désaffecter
                                </ActionButton>
                            )}
                            <Link href="/planning" className="btn light">
                                Voir le planning
                            </Link>
                        </div>
                        {planning && (
                            <div className="actions">
                                <CancelForm interventionId={id} />
                            </div>
                        )}
                    </Card>

                    {(i.report || i.quotes.length > 0) && (
                        <Card title="Documents">
                            {i.report && (
                                <div className="row">
                                    <div className="row-main">
                                        <Link className="row-title" href={`/rapports/${i.report.id}`}>
                                            Rapport d&apos;intervention
                                        </Link>
                                        <div className="muted">{i.report.billable ? i.report.billingNotes : 'Aucun élément facturable'}</div>
                                    </div>
                                    <Badge {...REPORT_STATUS[i.report.status]} />
                                </div>
                            )}
                            {i.quotes.map((q) => (
                                <div className="row" key={q.id}>
                                    <Link className="row-title" href={`/devis/${q.id}`}>
                                        Devis {q.number}
                                    </Link>
                                    <Badge {...QUOTE_STATUS[q.status]} />
                                </div>
                            ))}
                        </Card>
                    )}

                    <Card title="Historique">
                        <ActivityTimeline items={i.timeline} />
                    </Card>
                </div>

                <div className="stack">
                    {planning && (
                        <Card title={i.status === 'TO_SCHEDULE' ? 'Techniciens recommandés' : 'Replanifier'}>
                            <p className="muted" style={{ marginTop: 0 }}>
                                Score calculé sur la compétence, la disponibilité réelle du planning, le trajet et l&apos;historique
                                sur le site. Fluxia propose, vous validez.
                            </p>
                            <Recommendations interventionId={id} recommendations={recommendations} currentTechnicianId={i.technicianId} />
                            <details className="mt">
                                <summary>Affectation manuelle</summary>
                                <div className="mt">
                                    <ManualAssignForm
                                        interventionId={id}
                                        technicians={technicians}
                                        defaultDuration={i.estimatedMinutes}
                                        defaultStart={toLocalInput(recommendations[0]?.slot?.start ?? i.scheduledStart ?? new Date())}
                                    />
                                </div>
                            </details>
                        </Card>
                    )}

                    <Card title="Messages envoyés">
                        <MessageList messages={i.messages} />
                    </Card>
                </div>
            </div>
        </>
    );
}
