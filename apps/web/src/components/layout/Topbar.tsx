'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LABELS: Record<string, string> = {
    inbox: 'Inbox IA',
    nouvelle: 'Nouvelle demande',
    interventions: 'Interventions',
    planning: 'Planning',
    techniciens: 'Techniciens',
    rapports: 'Rapports',
    devis: 'Devis',
    clients: 'Clients',
};

export function Topbar({ user }: { user: { name: string; initials: string } }) {
    const segments = usePathname().split('/').filter(Boolean);

    return (
        <header className="top">
            <div className="row-flex" style={{ gap: 6 }}>
                <b>Fluxia</b>
                {segments.length === 0 && <span className="crumb">/ Vue d&apos;ensemble</span>}
                {segments.map((segment, i) => {
                    const href = `/${segments.slice(0, i + 1).join('/')}`;
                    const label = LABELS[segment] ?? 'Détail';
                    const last = i === segments.length - 1;
                    return (
                        <span key={href} className="crumb">
                            / {last ? label : <Link href={href}>{label}</Link>}
                        </span>
                    );
                })}
            </div>
            <div className="row-flex">
                <span className="muted">{user.name}</span>
                <div className="avatar">{user.initials}</div>
            </div>
        </header>
    );
}
