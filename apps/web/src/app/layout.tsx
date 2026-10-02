import type { Metadata } from 'next';
import { FlashToast } from '@/components/ui/FlashToast';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
    title: { default: 'Fluxia', template: '%s · Fluxia' },
    description: 'Le bureau administratif IA des entreprises de maintenance.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html lang="fr">
            <body>
                <ToastProvider>
                    <FlashToast />
                    {children}
                </ToastProvider>
            </body>
        </html>
    );
}
