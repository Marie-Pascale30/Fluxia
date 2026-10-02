import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { formatSlot, INTERVENTION_STATUS, INTERVENTION_TYPE, PRIORITY } from '@/lib/format';
import type { InterventionStatus } from '@/lib/types';

export const metadata = { title: 'Interventions' };

const GROUPS: { key: string; label: string; statuses: InterventionStatus[] | null }[] = [
    { key: 'todo', label: 'À planifier', statuses: ['TO_SCHEDULE'] },
    { key: 'planned', label: 'Planifiées', statuses: ['SCHEDULED', 'DISPATCHED'] },
    { key: 'ongoing', label: 'En cours', statuses: ['IN_PROGRESS'] },
    { key: 'done', label: 'Terminées', statuses: ['COMPLETED', 'CLOSED'] },
    { key: 'all', label: 'Toutes', statuses: null },
];

export default async function InterventionsPage({ searchParams }: PageProps<'/interventions'>) {
    const raw = (await searchParams).view;
    const all = await api.interventions.list();
    const counts = Object.fromEntries(GROUPS.map((g) => [g.key, all.filter((i) => !g.statuses || g.statuses.includes(i.status)).length]));
    const group = GROUPS.find((g) => g.key === raw) ?? (counts.todo ? GROUPS[0] : GROUPS[1]);
    const items = all.filter((i) => !group.statuses || group.statuses.includes(i.status));

    return (
        <>
            <PageHeader title="Interventions" subtitle="Du signalement à la clôture, chaque intervention suit un cycle de vie contrôlé." />
            <Tabs
                active={group.key}
                items={GROUPS.map((g) => ({ key: g.key, label: `${g.label} · ${counts[g.key]}`, href: `/interventions?view=${g.key}` }))}
            />
            <Card>
                {items.length === 0 ? (
                    <EmptyState title="Aucune intervention dans cette vue" />
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>N°</th>
                                <th>Intervention</th>
                                <th>Client</th>
                                <th>Priorité</th>
                                <th>Statut</th>
                                <th>Technicien</th>
                                <th>Créneau</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((i) => (
                                <tr key={i.id}>
                                    <td className="nowrap">
                                        <Link className="table-link" href={`/interventions/${i.id}`}>
                                            #{i.number}
                                        </Link>
                                    </td>
                                    <td>
                                        <Link className="table-link" href={`/interventions/${i.id}`}>
                                            {i.title}
                                        </Link>
                                        <div className="muted small">{INTERVENTION_TYPE[i.type]}</div>
                                    </td>
                                    <td>{i.client.name}</td>
                                    <td>
                                        <Badge {...PRIORITY[i.priority]} />
                                    </td>
                                    <td>
                                        <Badge {...INTERVENTION_STATUS[i.status]} />
                                    </td>
                                    <td>{i.technician ? `${i.technician.firstName} ${i.technician.lastName}` : '—'}</td>
                                    <td className="small">{i.scheduledStart ? formatSlot(i.scheduledStart, i.scheduledEnd) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </>
    );
}
