'use client';

import { assignManually } from '@/app/actions';
import { useActionToast } from '@/components/ui/useActionToast';
import type { Technician } from '@/lib/types';

export function ManualAssignForm({
    interventionId,
    technicians,
    defaultDuration,
    defaultStart,
}: {
    interventionId: string;
    technicians: Technician[];
    defaultDuration: number;
    defaultStart: string;
}) {
    const { formAction, pending } = useActionToast(assignManually.bind(null, interventionId));

    return (
        <form action={formAction} className="form">
            <div className="form-row">
                <label>
                    Technicien
                    <select name="technicianId" className="select" required defaultValue="">
                        <option value="" disabled>
                            Choisir…
                        </option>
                        {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.firstName} {t.lastName}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Début
                    <input type="datetime-local" name="start" className="input" required step={900} defaultValue={defaultStart} />
                </label>
                <label>
                    Durée (min)
                    <input type="number" name="duration" className="input" min={15} max={600} step={15} defaultValue={defaultDuration} />
                </label>
            </div>
            <div>
                <button className="btn light" disabled={pending}>
                    {pending ? 'Vérification du planning…' : 'Affecter manuellement'}
                </button>
            </div>
        </form>
    );
}
