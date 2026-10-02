'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { FLASH_COOKIE } from '@/lib/flash';
import { useToast } from './Toast';

/** Affiche le message "flash" laissé par une Server Action avant redirection. */
export function FlashToast() {
    const pathname = usePathname();
    const toast = useToast();

    useEffect(() => {
        const match = document.cookie.match(new RegExp(`(?:^|; )${FLASH_COOKIE}=([^;]*)`));
        if (!match) return;
        document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
        toast(decodeURIComponent(match[1]));
    }, [pathname, toast]);

    return null;
}
