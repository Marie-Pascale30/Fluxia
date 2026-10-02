'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/auth-actions';

const LABELS: Record<string, string> = {
    inbox: 'Inbox IA',
    nouvelle: 'Nouvelle demande',
    nouveau: 'Nouveau',
    interventions: 'Interventions',
    planning: 'Planning',
    techniciens: 'Techniciens',
    rapports: 'Rapports',
    devis: 'Devis',
    factures: 'Factures',
    clients: 'Clients',
    catalogue: 'Catalogue',
    parametres: 'Paramètres',
};

export function Topbar({ user }: { user: { name: string; initials: string; role: 'MANAGER' | 'TECHNICIAN' } }) {
    const segments = usePathname().split('/').filter(Boolean);
    const technician = user.role === 'TECHNICIAN';

    return (
        <header className="top">
            <div className="row-flex" style={{ gap: 6 }}>
                <b>Fluxia</b>
                {technician && <span className="crumb">/ Mes missions</span>}
                {!technician && segments.length === 0 && <span className="crumb">/ Vue d&apos;ensemble</span>}
                {!technician &&
                    segments.map((segment, i) => {
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
                <span className="muted">
                    {user.name}
                    {technician && ' · technicien'}
                </span>
                <div className="avatar">{user.initials}</div>
                <form action={logout}>
                    <button className="btn light sm" title="Se déconnecter">
                        Déconnexion
                    </button>
                </form>
            </div>
        </header>
    );
}
