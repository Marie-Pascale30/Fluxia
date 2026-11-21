import Link from 'next/link';
import { resetPassword } from '@/app/auth-actions';
import { PasswordForm } from '@/features/account/PasswordForm';

export const metadata = { title: 'Nouveau mot de passe', robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ params }: PageProps<'/mot-de-passe/[token]'>) {
    const { token } = await params;
    return (
        <main className="auth-page">
            <div className="auth-card card">
                <div className="auth-brand">
                    flux<span>ia</span>
                </div>
                <p className="muted">Choisissez votre nouveau mot de passe.</p>
                <PasswordForm action={resetPassword.bind(null, token)} submitLabel="Enregistrer et me connecter">
                    <label>
                        Nouveau mot de passe (8 caractères minimum)
                        <input name="password" type="password" className="input" autoComplete="new-password" required minLength={8} autoFocus />
                    </label>
                    <label>
                        Confirmation
                        <input name="confirm" type="password" className="input" autoComplete="new-password" required minLength={8} />
                    </label>
                </PasswordForm>
                <p className="muted small mt">
                    <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
                </p>
            </div>
        </main>
    );
}
