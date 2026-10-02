import { assignTechnician } from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge, EmptyState } from '@/components/ui';
import { formatSlot } from '@/lib/format';
import type { Recommendation } from '@/lib/types';

/** Techniciens classés par le moteur de planification, avec la justification de chaque score. */
export function Recommendations({
    interventionId,
    recommendations,
    currentTechnicianId,
}: {
    interventionId: string;
    recommendations: Recommendation[];
    currentTechnicianId?: string | null;
}) {
    if (!recommendations.length) return <EmptyState icon="☺" title="Aucun technicien actif" />;

    return (
        <div>
            {recommendations.map((reco, index) => {
                const best = index === 0 && reco.skillMatch && !!reco.slot;
                const current = reco.technicianId === currentTechnicianId;
                return (
                    <div key={reco.technicianId} className={`reco ${best ? 'best' : ''}`}>
                        <div className="row-flex">
                            <div className="grow">
                                <div className="row-flex" style={{ gap: 6 }}>
                                    <b>{reco.technicianName}</b>
                                    {best && <Badge label="Recommandé" tone="green" />}
                                    {current && <Badge label="Affecté" tone="blue" />}
                                    {!reco.skillMatch && <Badge label="Hors compétence" tone="red" />}
                                </div>
                                <div className="muted small">
                                    {reco.slot ? formatSlot(reco.slot.start, reco.slot.end) : 'Aucun créneau disponible'}
                                </div>
                            </div>
                            <div className="right">
                                <div className="score">{reco.score}</div>
                                <div className="muted small">/ 100</div>
                            </div>
                        </div>
                        <div className="bar">
                            <span style={{ width: `${reco.score}%` }} />
                        </div>
                        <ul className="reasons">
                            {reco.reasons.map((r) => (
                                <li key={r.label} className={r.positive ? '' : 'neg'}>
                                    <b>{r.label}</b> — {r.detail}
                                </li>
                            ))}
                        </ul>
                        {reco.slot && (
                            <div className="actions" style={{ marginTop: 10 }}>
                                <ActionButton
                                    action={assignTechnician.bind(null, interventionId, reco.technicianId, reco.slot.start)}
                                    variant={best ? 'ai' : 'light'}
                                    size="sm"
                                    pendingLabel="Affectation…"
                                    confirm={reco.skillMatch ? undefined : `${reco.technicianName} n'a pas la compétence requise. Affecter quand même ?`}
                                >
                                    {current ? 'Déplacer sur ce créneau' : `Affecter ${reco.technicianName.split(' ')[0]}`}
                                </ActionButton>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
