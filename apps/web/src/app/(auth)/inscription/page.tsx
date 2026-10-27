import Link from 'next/link';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'Créer un compte' };

/** Inscription d'une nouvelle entreprise : son espace est indépendant de ceux des autres entreprises. */
export default function SignupPage() {
    return (
        <main className="auth-page">
            <div className="auth-card card">
                <div className="auth-brand">
                    flux<span>ia</span>
                </div>
                <p className="muted">Créez l’espace de votre entreprise. Vous en serez le responsable et pourrez ensuite ajouter vos techniciens.</p>
                <SignupForm />
                <p className="muted small mt">
                    Déjà un compte ? <Link href="/login">Se connecter</Link>
                </p>
            </div>
        </main>
    );
}
