// Composants de présentation (Server Components : aucun état, aucun effet).
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ACTOR, formatDateTime, type Tone } from '@/lib/format';
import type { Activity } from '@/lib/types';

export function Badge({ label, tone }: { label: ReactNode; tone?: Tone }) {
    return <span className={['pill', tone].filter(Boolean).join(' ')}>{label}</span>;
}

export function Card({
    title,
    action,
    children,
    className,
}: {
    title?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={['card', className].filter(Boolean).join(' ')}>
            {(title || action) && (
                <div className="card-title">
                    <span>{title}</span>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="page-head">
            <div>
                <h1 className="h1">{title}</h1>
                {subtitle && <div className="sub">{subtitle}</div>}
            </div>
            {actions && <div className="row-flex">{actions}</div>}
        </div>
    );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
    return (
        <div className="kv">
            {items.map(([k, v]) => (
                <Fragment key={k}>
                    <div className="k">{k}</div>
                    <div>{v ?? '—'}</div>
                </Fragment>
            ))}
        </div>
    );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="field">
            <div className="label">{label}</div>
            <div className="value">{children}</div>
        </div>
    );
}

export function Notice({
    tone,
    title,
    children,
}: {
    tone?: 'success' | 'warning' | 'danger';
    title?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className={['notice', tone].filter(Boolean).join(' ')}>
            {title && <b>{title}</b>}
            {title && children && <br />}
            {children}
        </div>
    );
}

export function Kpi({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
    const body = (
        <>
            <div className="muted">{label}</div>
            <div className="kpi">{value}</div>
            {hint && <div className="muted">{hint}</div>}
        </>
    );
    return href ? (
        <Link href={href} className="card kpi-card">
            {body}
        </Link>
    ) : (
        <div className="card kpi-card">{body}</div>
    );
}

export function Row({ title, subtitle, aside, href }: { title: ReactNode; subtitle?: ReactNode; aside?: ReactNode; href?: string }) {
    const inner = (
        <>
            <div className="row-main">
                <div className="row-title">{title}</div>
                {subtitle && <div className="muted">{subtitle}</div>}
            </div>
            {aside}
        </>
    );
    return href ? (
        <Link href={href} className="row">
            {inner}
        </Link>
    ) : (
        <div className="row">{inner}</div>
    );
}

export function Stepper({ steps }: { steps: { label: string; state: 'done' | 'current' | 'todo' }[] }) {
    return (
        <div className="flow">
            {steps.map((s, i) => (
                <span key={s.label} className="row-flex" style={{ gap: 8 }}>
                    {i > 0 && <span className="flow-arrow">→</span>}
                    <span className={`step ${s.state === 'todo' ? '' : s.state}`}>{s.label}</span>
                </span>
            ))}
        </div>
    );
}

export function Avatar({ label }: { label: string }) {
    return <div className="avatar">{label}</div>;
}

export function EmptyState({ icon = '✓', title, children }: { icon?: string; title: string; children?: ReactNode }) {
    return (
        <div className="empty">
            <div className="big">{icon}</div>
            <div className="strong">{title}</div>
            {children && <div className="muted mt">{children}</div>}
        </div>
    );
}

export function ActivityTimeline({ items, empty = 'Aucun événement' }: { items: Activity[]; empty?: string }) {
    if (!items.length) return <div className="muted">{empty}</div>;
    return (
        <div className="timeline">
            {items.map((a) => (
                <div key={a.id} className={`event ${a.actor === 'AI' ? 'ai' : a.actor === 'USER' ? 'user' : ''}`}>
                    <div>{a.message}</div>
                    <div className="muted small">
                        {ACTOR[a.actor]} · {formatDateTime(a.createdAt)}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function Tabs({ items, active }: { items: { key: string; label: ReactNode; href: string }[]; active: string }) {
    return (
        <nav className="tabs">
            {items.map((t) => (
                <Link key={t.key} href={t.href} className={`tab ${t.key === active ? 'active' : ''}`}>
                    {t.label}
                </Link>
            ))}
        </nav>
    );
}
