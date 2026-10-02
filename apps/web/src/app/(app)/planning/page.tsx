import Link from 'next/link';
import { Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { PlanningBoard } from '@/features/planning/PlanningBoard';
import { WeekGrid } from '@/features/planning/WeekGrid';
import { api } from '@/lib/api';
import { dayKey, formatLongDay, minutesOfDay, shiftDay } from '@/lib/format';

export const metadata = { title: 'Planning' };

/** Lundi de la semaine contenant `date` (clé YYYY-MM-DD). */
function monday(date: string) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = dimanche
    return shiftDay(date, weekday === 0 ? -6 : 1 - weekday);
}

export default async function PlanningPage({ searchParams }: PageProps<'/planning'>) {
    const params = await searchParams;
    const today = dayKey();
    const date = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
    const week = params.view === 'week';
    const step = week ? 7 : 1;
    const link = (d: string) => `/planning?date=${d}${week ? '&view=week' : ''}`;

    const header = (
        <PageHeader
            title="Planning"
            subtitle={week ? 'Charge de la semaine par technicien.' : 'Glissez les interventions pour les planifier ou les déplacer.'}
            actions={
                <>
                    <Link className="btn light sm" href={link(shiftDay(date, -step))} aria-label="Période précédente">
                        ←
                    </Link>
                    <Link className={`btn sm ${date === today ? '' : 'light'}`} href={week ? '/planning?view=week' : '/planning'}>
                        Aujourd&apos;hui
                    </Link>
                    <Link className="btn light sm" href={link(shiftDay(date, step))} aria-label="Période suivante">
                        →
                    </Link>
                </>
            }
        />
    );
    const tabs = (
        <Tabs
            active={week ? 'week' : 'day'}
            items={[
                { key: 'day', label: 'Jour', href: `/planning?date=${date}` },
                { key: 'week', label: 'Semaine', href: `/planning?date=${date}&view=week` },
            ]}
        />
    );

    if (week) {
        const start = monday(date);
        const days = await Promise.all([0, 1, 2, 3, 4].map((i) => api.planning(shiftDay(start, i))));
        return (
            <>
                {header}
                {tabs}
                <Card title={`Semaine du ${formatLongDay(`${start}T12:00:00`)}`}>
                    <WeekGrid days={days} />
                </Card>
            </>
        );
    }

    const day = await api.planning(date);
    const total = day.technicians.reduce((sum, t) => sum + t.interventions.length, 0);
    return (
        <>
            {header}
            {tabs}
            <Card
                title={<span style={{ textTransform: 'capitalize' }}>{formatLongDay(`${date}T12:00:00`)}</span>}
                action={<span className="muted">{total} intervention(s)</span>}
            >
                {day.technicians.length ? (
                    <PlanningBoard day={day} date={date} nowMinutes={date === today ? minutesOfDay(new Date()) : null} />
                ) : (
                    <EmptyState title="Aucun technicien actif" />
                )}
            </Card>
        </>
    );
}
