'use client';

import { useRouter } from 'next/navigation';
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

/** Bouton qui exécute une Server Action, affiche le résultat en toast et suit une éventuelle redirection. */
export function ActionButton({ action, children, pendingLabel, variant, size, confirm, disabled, title }: Props) {
    const [pending, startTransition] = useTransition();
    const toast = useToast();
    const router = useRouter();

    const onClick = () => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
            const result = await action();
            // Pas de résultat : l'action a redirigé (message transmis par FlashToast)
            if (!result) return;
            toast(result.message, result.ok ? 'info' : 'error');
            if (result.ok && result.redirectTo) router.push(result.redirectTo);
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
