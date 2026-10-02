import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Row } from '@/components/ui';
import { DayGrid } from '@/features/planning/DayGrid';
import { api } from '@/lib/api';
import { dayKey, formatDuration, formatLongDay, minutesOfDay, PRIORITY, shiftDay } from '@/lib/format';

export const metadata = { title: 'Planning' };

export default async function PlanningPage({ searchParams }: PageProps<'/planning'>) {
    const raw = (await searchParams).date;
    const today = dayKey();
    const date = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    const day = await api.planning(date);
    const isToday = date === today;
    const total = day.technicians.reduce((sum, t) => sum + t.interventions.length, 0);

    return (
        <>
            <PageHeader
                title="Planning"
                subtitle="Le planning reflète en temps réel les décisions prises dans le parcours."
                actions={
                    <>
                        <Link className="btn light sm" href={`/planning?date=${shiftDay(date, -1)}`}>
                            ←
                        </Link>
                        <Link className={`btn sm ${isToday ? '' : 'light'}`} href="/planning">
                            Aujourd&apos;hui
                        </Link>
                        <Link className="btn light sm" href={`/planning?date=${shiftDay(date, 1)}`}>
                            →
                        </Link>
                    </>
                }
            />

            <div className="main-aside planning-layout">
                <Card title={<span style={{ textTransform: 'capitalize' }}>{formatLongDay(`${date}T12:00:00`)}</span>} action={<span className="muted">{total} intervention(s)</span>}>
                    {day.technicians.length ? (
                        <DayGrid day={day} nowMinutes={isToday ? minutesOfDay(new Date()) : null} />
                    ) : (
                        <EmptyState title="Aucun technicien actif" />
                    )}
                </Card>

                <Card title="À planifier" action={<Badge label={day.unscheduled.length} tone={day.unscheduled.length ? 'orange' : undefined} />}>
                    {day.unscheduled.length === 0 && <div className="muted">Tout est planifié.</div>}
                    {day.unscheduled.map((i) => (
                        <Row
                            key={i.id}
                            href={`/interventions/${i.id}`}
                            title={`#${i.number} · ${i.title}`}
                            subtitle={`${i.client.name} · ${formatDuration(i.estimatedMinutes)}`}
                            aside={<Badge {...PRIORITY[i.priority]} />}
                        />
                    ))}
                </Card>
            </div>
        </>
    );
}
