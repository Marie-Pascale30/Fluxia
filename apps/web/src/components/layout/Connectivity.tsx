'use client';

import { useOffline } from 'next/offline';
import { useEffect } from 'react';

/** Bandeau hors ligne : les actions en cours partiront automatiquement au retour du réseau. */
export function OfflineBanner() {
    const offline = useOffline();
    if (!offline) return null;
    return (
        <div className="offline-banner" role="status">
            Hors ligne — vos actions sont conservées et seront envoyées dès le retour du réseau.
        </div>
    );
}

/** Enregistre le service worker (production uniquement : en dev il gênerait le rechargement à chaud). */
export function ServiceWorker() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }, []);
    return null;
}

/** À la déconnexion : vide les pages mises en cache pour l'utilisateur. */
export function clearOfflineCache() {
    navigator.serviceWorker?.controller?.postMessage('clear');
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith('fluxia:')) localStorage.removeItem(key);
        }
    } catch {
        // stockage indisponible (navigation privée)
    }
}
