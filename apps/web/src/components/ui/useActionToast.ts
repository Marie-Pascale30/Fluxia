'use client';

import { useActionState, useEffect } from 'react';
import type { ActionResult } from '@/app/actions';
import { useToast } from './Toast';

type FormAction = (state: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** useActionState + toast des erreurs (le succès est annoncé par FlashToast). */
export function useActionToast(action: FormAction, onSuccess?: (result: ActionResult) => void) {
    const [state, formAction, pending] = useActionState(action, null);
    const toast = useToast();

    useEffect(() => {
        if (!state) return;
        if (state.ok) onSuccess?.(state);
        else toast(state.message, 'error');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    return { state, formAction, pending };
}
