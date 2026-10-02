'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import type { ActionResult } from '@/app/actions';
import { useToast } from './Toast';

type FormAction = (state: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** useActionState + toast + redirection : pour les formulaires branchés sur une Server Action. */
export function useActionToast(action: FormAction, onSuccess?: () => void) {
    const [state, formAction, pending] = useActionState(action, null);
    const toast = useToast();
    const router = useRouter();

    useEffect(() => {
        if (!state) return;
        toast(state.message, state.ok ? 'info' : 'error');
        if (state.ok) {
            onSuccess?.();
            if (state.redirectTo) router.push(state.redirectTo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    return { state, formAction, pending };
}
