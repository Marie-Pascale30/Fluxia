import Link from 'next/link';

/** Pages publiques d'information (conditions, confidentialité). */
export default function LegalLayout({ children }: LayoutProps<'/'>) {
    return (
        <div className="portal">
            <header className="portal-head">
                <Link href="/" className="auth-brand" style={{ textDecoration: 'none' }}>
                    flux<span>ia</span>
                </Link>
            </header>
            <main className="portal-main legal">{children}</main>
        </div>
    );
}
