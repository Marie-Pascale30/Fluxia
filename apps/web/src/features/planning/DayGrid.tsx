import Link from 'next/link';
import { formatTime, minutesOfDay } from '@/lib/format';
import type { PlanningDay } from '@/lib/types';

const START_HOUR = 8;
const END_HOUR = 18;
const PX_PER_MINUTE = 1.1;
const HEIGHT = (END_HOUR - START_HOUR) * 60 * PX_PER_MINUTE;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const top = (minutes: number) => (minutes - START_HOUR * 60) * PX_PER_MINUTE;

/** Grille journée : une colonne par technicien, créneaux positionnés à l'échelle. */
export function DayGrid({ day, nowMinutes }: { day: PlanningDay; nowMinutes: number | null }) {
    const columns = `64px repeat(${day.technicians.length}, minmax(150px, 1fr))`;

    return (
        <div style={{ overflowX: 'auto' }}>
            <div className="planning" style={{ gridTemplateColumns: columns }}>
                <div className="planning-head" />
                {day.technicians.map((t) => (
                    <div key={t.id} className="planning-head">
                        <Link href={`/techniciens/${t.id}`} className="strong" style={{ textDecoration: 'none' }}>
                            {t.firstName} {t.lastName[0]}.
                        </Link>
                        <div className="muted small">{t.interventions.length} intervention(s)</div>
                    </div>
                ))}

                <div className="planning-hours" style={{ height: HEIGHT }}>
                    {HOURS.map((h) => (
                        <span key={h} className="planning-hour" style={{ top: top(h * 60) }}>
                            {String(h).padStart(2, '0')}:00
                        </span>
                    ))}
                </div>

                {day.technicians.map((t) => (
                    <div
                        key={t.id}
                        className="planning-col"
                        style={{ height: HEIGHT, backgroundSize: `100% ${60 * PX_PER_MINUTE}px` }}
                    >
                        {nowMinutes !== null && nowMinutes > START_HOUR * 60 && nowMinutes < END_HOUR * 60 && (
                            <div className="now-line" style={{ top: top(nowMinutes) }} />
                        )}
                        {t.interventions.map((i) => {
                            const start = minutesOfDay(i.scheduledStart!);
                            const end = minutesOfDay(i.scheduledEnd!);
                            const tone =
                                i.status === 'COMPLETED' || i.status === 'CLOSED'
                                    ? 'muted-slot'
                                    : i.priority === 'URGENT'
                                      ? 'urgent'
                                      : i.status === 'IN_PROGRESS'
                                        ? 'ok'
                                        : '';
                            return (
                                <Link
                                    key={i.id}
                                    href={`/interventions/${i.id}`}
                                    className={`slot ${tone}`}
                                    style={{ top: top(start) + 1, height: Math.max(28, (end - start) * PX_PER_MINUTE - 2) }}
                                    title={`${i.title} — ${i.client.name}`}
                                >
                                    <b>
                                        {formatTime(i.scheduledStart!)} · {i.title}
                                    </b>
                                    <br />
                                    {i.client.name}
                                    {i.status === 'SCHEDULED' && <span className="muted"> · à envoyer</span>}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
