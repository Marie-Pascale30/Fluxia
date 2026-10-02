import { Notice } from '@/components/ui';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
    const { next, expired } = await searchParams;

    return (
        <main className="auth-page">
            <div className="auth-card card">
                <div className="auth-brand">
                    flux<span>ia</span>
                </div>
                <p className="muted">Le bureau administratif IA des entreprises de maintenance.</p>
                {expired && <Notice tone="warning">Votre session a expiré, reconnectez-vous.</Notice>}
                <LoginForm next={typeof next === 'string' ? next : undefined} />
                {process.env.NODE_ENV !== 'production' && (
                    <p className="muted small mt">
                        Démo : <code>julien@fluxia.fr</code> (responsable) ou <code>thomas.martin@fluxia.fr</code> (technicien),
                        mot de passe <code>fluxia-demo</code>.
                    </p>
                )}
            </div>
        </main>
    );
}
