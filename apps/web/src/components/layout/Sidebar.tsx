'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavCounters {
    inbox: number;
    urgent: number;
    toSchedule: number;
    reports: number;
    quotes: number;
}

const SECTIONS = [
    {
        title: 'Pilotage',
        items: [
            { href: '/', label: "Vue d'ensemble", icon: '◎' },
            { href: '/inbox', label: 'Inbox IA', icon: '✉', badge: 'inbox' },
        ],
    },
    {
        title: 'Opérations',
        items: [
            { href: '/interventions', label: 'Interventions', icon: '⚒', badge: 'toSchedule' },
            { href: '/planning', label: 'Planning', icon: '▦' },
            { href: '/techniciens', label: 'Techniciens', icon: '☺' },
        ],
    },
    {
        title: 'Administratif',
        items: [
            { href: '/rapports', label: 'Rapports', icon: '▤', badge: 'reports' },
            { href: '/devis', label: 'Devis', icon: '€', badge: 'quotes' },
            { href: '/clients', label: 'Clients', icon: '⌂' },
        ],
    },
] as const;

export function Sidebar({ counters, aiProvider }: { counters: NavCounters | null; aiProvider: string | null }) {
    const pathname = usePathname();
    const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

    return (
        <aside className="side">
            <Link href="/" className="brand">
                flux<span>ia</span>
            </Link>
            <nav>
                {SECTIONS.map((section) => (
                    <div key={section.title}>
                        <div className="nav-section">{section.title}</div>
                        {section.items.map((item) => {
                            const count = 'badge' in item && counters ? counters[item.badge] : 0;
                            const alert = 'badge' in item && item.badge === 'inbox' && (counters?.urgent ?? 0) > 0;
                            return (
                                <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
                                    <span className="icon" aria-hidden>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                    {count > 0 && <span className={`count ${alert ? 'alert' : ''}`}>{count}</span>}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>
            <div className="side-footer">IA : {aiProvider ?? 'hors ligne'}</div>
        </aside>
    );
}
