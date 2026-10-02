import type { InterventionDetail, InterventionStatus } from '@/lib/types';

const ORDER: InterventionStatus[] = ['TO_SCHEDULE', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];

// Pour chaque étape : rang à partir duquel elle est en cours, et rang où elle est terminée
const STEPS = [
    { label: 'Technicien affecté', from: 0, doneAt: 1 },
    { label: 'Mission envoyée', from: 1, doneAt: 2 },
    { label: 'Intervention réalisée', from: 2, doneAt: 4 },
    { label: 'Rapport envoyé', from: 4, doneAt: 5 },
];

/** Étapes du parcours affichées dans le Stepper, déduites du statut. */
export function interventionSteps(i: Pick<InterventionDetail, 'status' | 'request'>) {
    const rank = ORDER.indexOf(i.status);
    return [
        ...(i.request ? [{ label: 'Demande comprise', state: 'done' as const }] : []),
        { label: 'Intervention créée', state: 'done' as const },
        ...STEPS.map((s) => ({
            label: s.label,
            state: rank >= s.doneAt ? ('done' as const) : rank >= s.from ? ('current' as const) : ('todo' as const),
        })),
    ];
}
