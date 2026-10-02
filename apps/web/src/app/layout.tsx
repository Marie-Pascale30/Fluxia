import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { FlashToast } from '@/components/ui/FlashToast';
import { ToastProvider } from '@/components/ui/Toast';
import { FLASH_COOKIE } from '@/lib/flash';
import './globals.css';

export const metadata: Metadata = {
    title: { default: 'Fluxia', template: '%s · Fluxia' },
    description: 'Le bureau administratif IA des entreprises de maintenance.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
    const flash = (await cookies()).get(FLASH_COOKIE)?.value;
    return (
        <html lang="fr">
            <body>
                <ToastProvider>
                    <FlashToast value={flash} />
                    {children}
                </ToastProvider>
            </body>
        </html>
    );
}
