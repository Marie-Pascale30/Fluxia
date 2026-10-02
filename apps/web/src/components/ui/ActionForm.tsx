'use client';

import { useRef, type ReactNode } from 'react';
import type { ActionResult } from '@/app/actions';
import { useActionToast } from './useActionToast';

type FormAction = (state: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * Formulaire branché sur une Server Action : toast du résultat, état d'envoi,
 * remise à zéro facultative. Les champs peuvent être rendus côté serveur (children).
 */
export function ActionForm({
    action,
    children,
    submitLabel,
    pendingLabel = 'Enregistrement…',
    variant,
    resetOnSuccess = false,
    onSuccess,
    className = 'form',
}: {
    action: FormAction;
    children: ReactNode;
    submitLabel: string;
    pendingLabel?: string;
    variant?: 'light' | 'ai' | 'green';
    resetOnSuccess?: boolean;
    onSuccess?: (result: ActionResult) => void;
    className?: string;
}) {
    const formRef = useRef<HTMLFormElement>(null);
    const { formAction, pending } = useActionToast(action, (result) => {
        if (resetOnSuccess) formRef.current?.reset();
        onSuccess?.(result);
    });

    return (
        <form ref={formRef} action={formAction} className={className}>
            {children}
            <div>
                <button className={['btn', variant].filter(Boolean).join(' ')} disabled={pending}>
                    {pending ? pendingLabel : submitLabel}
                </button>
            </div>
        </form>
    );
}
