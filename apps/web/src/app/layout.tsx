import type { Metadata } from 'next';
import { Sidebar, type NavCounters } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { FlashToast } from '@/components/ui/FlashToast';
import { ToastProvider } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { providerLabel } from '@/lib/format';
import './globals.css';

export const metadata: Metadata = {
    title: { default: 'Fluxia', template: '%s · Fluxia' },
    description: 'Le bureau administratif IA des entreprises de maintenance.',
};

// Utilisateur courant (à remplacer par la session une fois l'authentification ajoutée)
const CURRENT_USER = { name: 'Julien Durand', firstName: 'Julien', initials: 'JD' };

async function loadNav(): Promise<{ counters: NavCounters | null; aiProvider: string | null }> {
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
            },
        };
    } catch {
        return { counters: null, aiProvider: null };
    }
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
    const nav = await loadNav();

    return (
        <html lang="fr">
            <body>
                <ToastProvider>
                    <FlashToast />
                    <Sidebar counters={nav.counters} aiProvider={nav.aiProvider} />
                    <div className="main">
                        <Topbar user={CURRENT_USER} />
                        <main className="content">{children}</main>
                    </div>
                </ToastProvider>
            </body>
        </html>
    );
}
