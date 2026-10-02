import Link from 'next/link';
import { dayKey, formatTime } from '@/lib/format';
import type { PlanningDay } from '@/lib/types';

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });

/** Vue semaine : une ligne par technicien, une colonne par jour ouvré. */
export function WeekGrid({ days }: { days: PlanningDay[] }) {
    const technicians = days[0]?.technicians ?? [];
    const today = dayKey();

    return (
        <div className="planning-scroll">
            <table className="table week-grid">
                <thead>
                    <tr>
                        <th style={{ width: 120 }}>Technicien</th>
                        {days.map((d) => (
                            <th key={d.date} className={dayKey(d.date) === today ? 'today' : undefined}>
                                <Link href={`/planning?date=${dayKey(d.date)}`}>{WEEKDAY.format(new Date(d.date))}</Link>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {technicians.map((t) => (
                        <tr key={t.id}>
                            <td className="strong">
                                {t.firstName} {t.lastName[0]}.
                            </td>
                            {days.map((d) => {
                                const items = d.technicians.find((x) => x.id === t.id)?.interventions ?? [];
                                const minutes = items.reduce((s, i) => s + (new Date(i.scheduledEnd!).getTime() - new Date(i.scheduledStart!).getTime()) / 60_000, 0);
                                return (
                                    <td key={d.date} className={dayKey(d.date) === today ? 'today' : undefined}>
                                        <div className="week-load" title={`${Math.round(minutes / 60)} h planifiées`}>
                                            <span style={{ width: `${Math.min(100, (minutes / 600) * 100)}%` }} />
                                        </div>
                                        {items.map((i) => (
                                            <Link key={i.id} href={`/interventions/${i.id}`} className={`week-item ${i.priority === 'URGENT' ? 'urgent' : ''}`}>
                                                <b>{formatTime(i.scheduledStart!)}</b> {i.title}
                                                <div className="muted">{i.client.name}</div>
                                            </Link>
                                        ))}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
