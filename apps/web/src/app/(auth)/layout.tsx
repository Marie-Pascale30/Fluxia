import { LegalFooter } from '@/components/layout/LegalFooter';

/** Pages publiques de connexion : liens vers les informations légales en pied de page. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
    return (
        <div className="auth-shell">
            {children}
            <LegalFooter />
        </div>
    );
}
