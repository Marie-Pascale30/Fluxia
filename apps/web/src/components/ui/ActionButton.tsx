'use client';

import { useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/app/actions';
import { useToast } from './Toast';

interface Props {
    /** Server Action déjà liée à ses arguments (action.bind(null, id)) */
    action: () => Promise<ActionResult>;
    children: ReactNode;
    pendingLabel?: string;
    variant?: 'light' | 'ai' | 'green' | 'danger';
    size?: 'sm';
    confirm?: string;
    disabled?: boolean;
    title?: string;
}

/** Bouton qui exécute une Server Action ; les erreurs s'affichent en toast. */
export function ActionButton({ action, children, pendingLabel, variant, size, confirm, disabled, title }: Props) {
    const [pending, startTransition] = useTransition();
    const toast = useToast();

    const onClick = () => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
            const result = await action();
            // Succès : message affiché par FlashToast ; redirection gérée côté serveur
            if (result && !result.ok) toast(result.message, 'error');
        });
    };

    return (
        <button
            type="button"
            className={['btn', variant, size].filter(Boolean).join(' ')}
            onClick={onClick}
            disabled={disabled || pending}
            title={title}
        >
            {pending ? (pendingLabel ?? '…') : children}
        </button>
    );
}
