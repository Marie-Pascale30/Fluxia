'use client';

import Link from 'next/link';
import { useState, useTransition, type DragEvent } from 'react';
import { assignTechnician } from '@/app/actions';
import { Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { formatDuration, formatTime, fromLocalInput, minutesOfDay, PRIORITY } from '@/lib/format';
import type { Intervention, PlanningDay } from '@/lib/types';

const START_HOUR = 8;
const END_HOUR = 18;
const PX_PER_MINUTE = 1.1;
const SNAP = 15;
const HEIGHT = (END_HOUR - START_HOUR) * 60 * PX_PER_MINUTE;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const MOVABLE = ['TO_SCHEDULE', 'SCHEDULED', 'DISPATCHED'];

const top = (minutes: number) => (minutes - START_HOUR * 60) * PX_PER_MINUTE;
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

interface Dragged {
    id: string;
    number: number;
    minutes: number;
    status: Intervention['status'];
}

/**
 * Planning du jour : glisser une intervention (ou une intervention « à planifier »)
 * sur la colonne d'un technicien pour l'affecter. L'API vérifie les conflits.
 */
export function PlanningBoard({ day, date, nowMinutes }: { day: PlanningDay; date: string; nowMinutes: number | null }) {
    const [dragged, setDragged] = useState<Dragged | null>(null);
    const [target, setTarget] = useState<{ technicianId: string; minutes: number } | null>(null);
    const [pending, startTransition] = useTransition();
    const toast = useToast();

    const columns = `64px repeat(${day.technicians.length}, minmax(150px, 1fr))`;

    const begin = (e: DragEvent, i: Pick<Intervention, 'id' | 'number' | 'estimatedMinutes' | 'status'>) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', i.id);
        setDragged({ id: i.id, number: i.number, minutes: i.estimatedMinutes, status: i.status });
    };

    /** Heure de début correspondant à la position du pointeur, calée au quart d'heure. */
    const minutesAt = (e: DragEvent<HTMLDivElement>, duration: number) => {
        const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
        const raw = START_HOUR * 60 + y / PX_PER_MINUTE - duration / 2;
        const snapped = Math.round(raw / SNAP) * SNAP;
        return Math.min(Math.max(snapped, START_HOUR * 60), END_HOUR * 60 - duration);
    };

    const over = (e: DragEvent<HTMLDivElement>, technicianId: string) => {
        if (!dragged) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const minutes = minutesAt(e, dragged.minutes);
        if (target?.technicianId !== technicianId || target.minutes !== minutes) setTarget({ technicianId, minutes });
    };

    const drop = (e: DragEvent<HTMLDivElement>, technicianId: string, technicianName: string) => {
        e.preventDefault();
        const item = dragged;
        const minutes = item ? minutesAt(e, item.minutes) : null;
        setDragged(null);
        setTarget(null);
        if (!item || minutes === null) return;
        if (item.status === 'DISPATCHED' && !window.confirm(`La mission #${item.number} a déjà été envoyée : la déplacer imposera de la renvoyer. Continuer ?`)) return;

        startTransition(async () => {
            const result = await assignTechnician(item.id, technicianId, fromLocalInput(`${date}T${hhmm(minutes)}`));
            if (!result.ok) toast(`${technicianName} à ${hhmm(minutes)} : ${result.message}`, 'error');
        });
    };

    const end = () => {
        setDragged(null);
        setTarget(null);
    };

    return (
        <div className={`planning-board ${pending ? 'is-saving' : ''}`}>
            <div className="planning-scroll">
                <div className="planning" style={{ gridTemplateColumns: columns }}>
                    <div className="planning-head" />
                    {day.technicians.map((t) => (
                        <div key={t.id} className="planning-head">
                            <Link href={`/techniciens/${t.id}?date=${date}`} className="strong" style={{ textDecoration: 'none' }}>
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
                            className={`planning-col ${target?.technicianId === t.id ? 'drop-target' : ''}`}
                            style={{ height: HEIGHT, backgroundSize: `100% ${60 * PX_PER_MINUTE}px` }}
                            onDragOver={(e) => over(e, t.id)}
                            onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) setTarget(null);
                            }}
                            onDrop={(e) => drop(e, t.id, t.firstName)}
                            data-technician={t.firstName}
                        >
                            {nowMinutes !== null && nowMinutes > START_HOUR * 60 && nowMinutes < END_HOUR * 60 && (
                                <div className="now-line" style={{ top: top(nowMinutes) }} />
                            )}
                            {t.interventions.map((i) => {
                                const start = minutesOfDay(i.scheduledStart!);
                                const finish = minutesOfDay(i.scheduledEnd!);
                                const movable = MOVABLE.includes(i.status);
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
                                        className={`slot ${tone} ${movable ? 'movable' : ''} ${dragged?.id === i.id ? 'dragging' : ''}`}
                                        style={{ top: top(start) + 1, height: Math.max(28, (finish - start) * PX_PER_MINUTE - 2) }}
                                        title={`${i.title} — ${i.client.name}${movable ? ' (glisser pour déplacer)' : ''}`}
                                        draggable={movable}
                                        onDragStart={(e) => begin(e, i)}
                                        onDragEnd={end}
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
                            {target?.technicianId === t.id && dragged && (
                                <div className="slot-ghost" style={{ top: top(target.minutes), height: dragged.minutes * PX_PER_MINUTE }}>
                                    {hhmm(target.minutes)} – {hhmm(target.minutes + dragged.minutes)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <aside className="card unscheduled">
                <div className="card-title">
                    <span>À planifier</span>
                    <Badge label={day.unscheduled.length} tone={day.unscheduled.length ? 'orange' : undefined} />
                </div>
                {day.unscheduled.length === 0 ? (
                    <div className="muted">Tout est planifié.</div>
                ) : (
                    <div className="muted small mb">Glissez une intervention sur la colonne d&apos;un technicien.</div>
                )}
                {day.unscheduled.map((i) => (
                    <div
                        key={i.id}
                        className={`unscheduled-item ${dragged?.id === i.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(e) => begin(e, i)}
                        onDragEnd={end}
                    >
                        <div className="row-flex">
                            <Link className="row-title grow" href={`/interventions/${i.id}`}>
                                #{i.number} · {i.title}
                            </Link>
                            <Badge {...PRIORITY[i.priority]} />
                        </div>
                        <div className="muted small">
                            {i.client.name} · {formatDuration(i.estimatedMinutes)}
                        </div>
                    </div>
                ))}
            </aside>
        </div>
    );
}
