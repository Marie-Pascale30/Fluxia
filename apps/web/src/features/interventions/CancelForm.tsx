'use client';

import { useState } from 'react';
import { cancelIntervention } from '@/app/actions';
import { useActionToast } from '@/components/ui/useActionToast';

export function CancelForm({ interventionId }: { interventionId: string }) {
    const [open, setOpen] = useState(false);
    const { formAction, pending } = useActionToast(cancelIntervention.bind(null, interventionId), () => setOpen(false));

    if (!open) {
        return (
            <button type="button" className="btn danger" onClick={() => setOpen(true)}>
                Annuler l&apos;intervention
            </button>
        );
    }

    return (
        <form action={formAction} className="form" style={{ width: '100%' }}>
            <label>
                Motif d&apos;annulation
                <input name="reason" className="input" required minLength={3} placeholder="Ex. : doublon, client injoignable, résolu à distance…" />
            </label>
            <div className="row-flex">
                <button className="btn danger" disabled={pending}>
                    {pending ? 'Annulation…' : "Confirmer l'annulation"}
                </button>
                <button type="button" className="btn light" onClick={() => setOpen(false)}>
                    Retour
                </button>
            </div>
        </form>
    );
}
