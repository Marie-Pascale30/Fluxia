'use client';

import { useEffect, useRef } from 'react';
import { decodeFlash, FLASH_COOKIE } from '@/lib/flash';
import { useToast } from './Toast';

/** Affiche le message de succès laissé par la dernière Server Action (lu côté serveur). */
export function FlashToast({ value }: { value?: string }) {
    const toast = useToast();
    const shown = useRef<string | null>(null);

    useEffect(() => {
        const flash = decodeFlash(value);
        if (!flash || shown.current === flash.id) return;
        shown.current = flash.id;
        document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
        toast(flash.message);
    }, [value, toast]);

    return null;
}
