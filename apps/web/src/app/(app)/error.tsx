'use client';

import { Notice } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const unreachable = /injoignable|fetch failed|ECONNREFUSED/i.test(error.message);

    return (
        <div className="card" style={{ maxWidth: 620 }}>
            <h1 className="h1">{unreachable ? 'API indisponible' : 'Une erreur est survenue'}</h1>
            <Notice tone="danger">{error.message}</Notice>
            {unreachable && (
                <p className="muted">
                    Démarrez le backend avec <code>npm run dev:api</code> (ou <code>npm run dev</code> à la racine), puis réessayez.
                </p>
            )}
            <button className="btn" onClick={reset}>
                Réessayer
            </button>
        </div>
    );
}
