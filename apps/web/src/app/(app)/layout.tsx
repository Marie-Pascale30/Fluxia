import { OfflineBanner, ServiceWorker } from '@/components/layout/Connectivity';
import { Sidebar, type NavCounters } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { initials, providerLabel } from '@/lib/format';
import type { SessionUser } from '@/lib/session';

async function loadNav(user: SessionUser): Promise<{ counters: NavCounters | null; aiProvider: string | null }> {
    if (user.role !== 'MANAGER') return { counters: null, aiProvider: null };
    try {
        const { counters, aiProvider } = await api.dashboard();
        return {
            aiProvider: providerLabel(aiProvider),
            counters: {
                inbox: counters.requestsPending,
                urgent: counters.urgentPending,
                toSchedule: counters.toSchedule,
                reports: counters.reportsPending,
                quotes: counters.quotesDraft,
                failedMessages: counters.messagesFailed,
                invoices: counters.invoicesDraft + counters.invoicesOverdue,
            },
        };
    } catch {
        return { counters: null, aiProvider: null };
    }
}

/** Coquille de l'application connectée : la session est vérifiée par l'API (redirection si invalide). */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
    const user = await getCurrentUser();
    const nav = await loadNav(user);
    const [first, last] = user.name.split(' ');

    return (
        <>
            <ServiceWorker />
            <OfflineBanner />
            <Sidebar counters={nav.counters} aiProvider={nav.aiProvider} user={user} />
            <div className="main">
                <Topbar user={{ name: user.name, initials: initials(first, last), role: user.role }} />
                <main className="content">{children}</main>
            </div>
        </>
    );
}
