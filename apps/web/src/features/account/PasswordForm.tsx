'use client';

import { useActionState } from 'react';
import type { PasswordState } from '@/app/auth-actions';

type Action = (state: PasswordState | null, form: FormData) => Promise<PasswordState>;

/** Formulaire de mot de passe (oubli, réinitialisation, changement) : message ou erreur sous les champs. */
export function PasswordForm({ action, submitLabel, children }: { action: Action; submitLabel: string; children: React.ReactNode }) {
    const [state, formAction, pending] = useActionState(action, null);
    return (
        <form action={formAction} className="form">
            {children}
            {state?.error && (
                <div className="form-error" role="alert">
                    {state.error}
                </div>
            )}
            {state?.message && (
                <div className="notice success" role="status">
                    {state.message}
                </div>
            )}
            <button className="btn" disabled={pending}>
                {pending ? 'Envoi…' : submitLabel}
            </button>
        </form>
    );
}
