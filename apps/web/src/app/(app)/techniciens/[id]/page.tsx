import Link from 'next/link';
import { startIntervention } from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';
import { Avatar, Badge, Card, EmptyState, KeyValue, Notice, PageHeader } from '@/components/ui';
import { PhotoGallery, SignatureView } from '@/features/field/PhotoGallery';
import { PhotoUploader } from '@/features/field/PhotoUploader';
import { SignaturePad } from '@/features/field/SignaturePad';
import { VoiceReportForm } from '@/features/technicians/VoiceReportForm';
import { api } from '@/lib/api';
import { orNotFound } from '@/lib/data';
import { dayKey, EQUIPMENT, formatLongDay, formatSlot, initials, INTERVENTION_STATUS, PRIORITY, shiftDay } from '@/lib/format';
import type { Mission } from '@/lib/types';

const mapsUrl = (m: Mission) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${m.site.address}, ${m.site.postalCode} ${m.site.city}`)}`;

function MissionCard({ mission: m, serverTranscription }: { mission: Mission; serverTranscription: boolean }) {
    const active = m.status === 'DISPATCHED' || m.status === 'IN_PROGRESS';
    const onSite = m.status === 'IN_PROGRESS' || m.status === 'COMPLETED';

    return (
        <Card>
            <div className="row-flex">
                <Badge label={`Mission #${m.number}`} tone="blue" />
                <Badge {...INTERVENTION_STATUS[m.status]} />
                {m.priority === 'URGENT' && <Badge {...PRIORITY.URGENT} />}
                <span className="muted small grow right">{formatSlot(m.scheduledStart!, m.scheduledEnd)}</span>
            </div>
            <h2>{m.client.name}</h2>
            <KeyValue
                items={[
                    ['Adresse', `${m.site.address}, ${m.site.postalCode} ${m.site.city}`],
                    ['Équipement', m.equipment ? `${m.equipment.label} (${EQUIPMENT[m.equipment.type]})` : '—'],
                    ['Problème', m.description],
                    ['Contact', m.client.contactName ?? m.client.phone ?? '—'],
                ]}
            />
            {m.initialDiagnosis && <Notice title="Piste de diagnostic">{m.initialDiagnosis}</Notice>}

            {m.status === 'SCHEDULED' && <Notice tone="warning">Mission pas encore envoyée par le bureau.</Notice>}

            {active && (
                <div className="actions">
                    <a href={mapsUrl(m)} target="_blank" rel="noreferrer" className="btn light">
                        Itinéraire
                    </a>
                    {m.status === 'DISPATCHED' && (
                        <ActionButton action={startIntervention.bind(null, m.id)} variant="green">
                            Je suis sur place
                        </ActionButton>
                    )}
                </div>
            )}

            {(onSite || m.attachments.some((a) => a.kind === 'PHOTO')) && (
                <div className="mt">
                    <h3>Photos</h3>
                    <PhotoGallery attachments={m.attachments} editable={onSite} />
                    {onSite && (
                        <div className="mt">
                            <PhotoUploader interventionId={m.id} />
                        </div>
                    )}
                </div>
            )}

            {active && (
                <div className="mt">
                    <h3>Compte rendu</h3>
                    <p className="muted">Parlez naturellement : Fluxia transforme votre note en rapport client et détecte ce qui est facturable.</p>
                    <VoiceReportForm interventionId={m.id} serverTranscription={serverTranscription} />
                </div>
            )}

            {onSite && (
                <div className="mt">
                    <h3>Signature du client</h3>
                    {m.signedBy ? (
                        <SignatureView attachments={m.attachments} signedBy={m.signedBy} signedAt={m.signedAt} />
                    ) : (
                        <SignaturePad interventionId={m.id} defaultName={m.client.contactName ?? ''} />
                    )}
                </div>
            )}

            {m.report && (
                <div className="actions">
                    <Link href={`/rapports/${m.report.id}`} className="btn light">
                        Voir le rapport
                    </Link>
                </div>
            )}
        </Card>
    );
}

export default async function TechnicianPage({ params, searchParams }: PageProps<'/techniciens/[id]'>) {
    const { id } = await params;
    const raw = (await searchParams).date;
    const today = dayKey();
    const date = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    const [technician, capabilities] = await Promise.all([orNotFound(api.technicians.get(id, date)), api.capabilities()]);
    const dayLabel = date === today ? "aujourd'hui" : formatLongDay(`${date}T12:00:00`);
    const pending = technician.missions.filter((m) => m.status !== 'COMPLETED' && m.status !== 'CLOSED');
    const done = technician.missions.length - pending.length;

    return (
        <>
            <PageHeader
                title={
                    <span className="row-flex">
                        <Avatar label={initials(technician.firstName, technician.lastName)} />
                        {technician.firstName} {technician.lastName}
                    </span>
                }
                subtitle={`Vue terrain · ${technician.missions.length} mission(s) ${dayLabel} · ${done} terminée(s)`}
                actions={
                    <>
                        <Link className="btn light sm" href={`/techniciens/${id}?date=${shiftDay(date, -1)}`}>
                            ←
                        </Link>
                        <Link className={`btn sm ${date === today ? '' : 'light'}`} href={`/techniciens/${id}`}>
                            Aujourd&apos;hui
                        </Link>
                        <Link className="btn light sm" href={`/techniciens/${id}?date=${shiftDay(date, 1)}`}>
                            →
                        </Link>
                    </>
                }
            />
            <div style={{ maxWidth: 760 }} className="stack">
                {technician.missions.length === 0 && (
                    <Card>
                        <EmptyState icon="☀" title={`Aucune mission ${dayLabel}`} />
                    </Card>
                )}
                {pending.map((m) => (
                    <MissionCard key={m.id} mission={m} serverTranscription={capabilities.transcription} />
                ))}
                {done > 0 && (
                    <details>
                        <summary>Missions terminées ({done})</summary>
                        <div className="stack mt">
                            {technician.missions
                                .filter((m) => m.status === 'COMPLETED' || m.status === 'CLOSED')
                                .map((m) => (
                                    <MissionCard key={m.id} mission={m} serverTranscription={capabilities.transcription} />
                                ))}
                        </div>
                    </details>
                )}
            </div>
        </>
    );
}
