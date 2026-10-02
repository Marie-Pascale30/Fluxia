import Link from 'next/link';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { EQUIPMENT, formatDuration, formatTime, initials, INTERVENTION_STATUS } from '@/lib/format';

export const metadata = { title: 'Techniciens' };

const WORKDAY_MINUTES = 10 * 60;

export default async function TechniciansPage() {
    const technicians = await api.technicians.list();

    return (
        <>
            <PageHeader title="Techniciens" subtitle="Charge du jour, compétences et accès à la vue terrain de chaque technicien." />
            <div className="grid g3">
                {technicians.map((t) => {
                    const load = Math.min(100, Math.round((t.plannedMinutes / WORKDAY_MINUTES) * 100));
                    return (
                        <Card key={t.id}>
                            <div className="row-flex">
                                <Avatar label={initials(t.firstName, t.lastName)} />
                                <div className="grow">
                                    <b>
                                        {t.firstName} {t.lastName}
                                    </b>
                                    <div className="muted small">{t.skills.map((s) => EQUIPMENT[s]).join(' · ')}</div>
                                </div>
                                <Badge label={load >= 80 ? 'Complet' : `${100 - load}% libre`} tone={load >= 80 ? 'red' : load >= 50 ? 'orange' : 'green'} />
                            </div>
                            <div className="bar mt">
                                <span style={{ width: `${load}%` }} />
                            </div>
                            <div className="muted small" style={{ marginTop: 4 }}>
                                {t.today.length} intervention(s) · {formatDuration(t.plannedMinutes)} planifiées
                            </div>
                            <div className="mt">
                                {t.today.map((i) => (
                                    <Link key={i.id} href={`/interventions/${i.id}`} className="row">
                                        <div className="row-main">
                                            <div className="row-title">
                                                {formatTime(i.scheduledStart!)} · {i.title}
                                            </div>
                                        </div>
                                        <Badge {...INTERVENTION_STATUS[i.status]} />
                                    </Link>
                                ))}
                            </div>
                            <div className="actions">
                                <Link href={`/techniciens/${t.id}`} className="btn ai sm">
                                    Vue terrain →
                                </Link>
                                {t.phone && <span className="muted small">{t.phone}</span>}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </>
    );
}
