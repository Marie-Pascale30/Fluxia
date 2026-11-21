import Link from 'next/link';
import { forgotPassword } from '@/app/auth-actions';
import { PasswordForm } from '@/features/account/PasswordForm';

export const metadata = { title: 'Mot de passe oublié' };

export default function ForgotPasswordPage() {
    return (
        <main className="auth-page">
            <div className="auth-card card">
                <div className="auth-brand">
                    flux<span>ia</span>
                </div>
                <p className="muted">Indiquez l’email de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
                <PasswordForm action={forgotPassword} submitLabel="Recevoir le lien">
                    <label>
                        Email
                        <input name="email" type="email" className="input" autoComplete="username" required autoFocus />
                    </label>
                </PasswordForm>
                <p className="muted small mt">
                    <Link href="/login">Retour à la connexion</Link>
                </p>
            </div>
        </main>
    );
}
