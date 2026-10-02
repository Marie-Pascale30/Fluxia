'use client';

import { useState } from 'react';
import { rotatePortalLink } from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';

export function PortalLink({ url, clientId }: { url: string; clientId: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="stack" style={{ gap: 8 }}>
            <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Lien de l'espace client" />
            <div className="row-flex">
                <button type="button" className="btn light sm" onClick={copy}>
                    {copied ? '✓ Copié' : 'Copier le lien'}
                </button>
                <a className="btn light sm" href={url} target="_blank" rel="noreferrer">
                    Ouvrir
                </a>
                <ActionButton
                    action={rotatePortalLink.bind(null, clientId)}
                    variant="danger"
                    size="sm"
                    confirm="Générer un nouveau lien ? Les liens déjà envoyés au client ne fonctionneront plus."
                >
                    Révoquer et régénérer
                </ActionButton>
            </div>
        </div>
    );
}
