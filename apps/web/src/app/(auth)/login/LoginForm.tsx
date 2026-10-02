'use client';

import { useActionState } from 'react';
import { login } from '@/app/auth-actions';

export function LoginForm({ next }: { next?: string }) {
    const [state, action, pending] = useActionState(login, null);

    return (
        <form action={action} className="form">
            {next && <input type="hidden" name="next" value={next} />}
            <label>
                Email
                <input name="email" type="email" className="input" autoComplete="username" required autoFocus />
            </label>
            <label>
                Mot de passe
                <input name="password" type="password" className="input" autoComplete="current-password" required />
            </label>
            {state?.error && (
                <div className="form-error" role="alert">
                    {state.error}
                </div>
            )}
            <button className="btn" disabled={pending}>
                {pending ? 'Connexion…' : 'Se connecter'}
            </button>
        </form>
    );
}
