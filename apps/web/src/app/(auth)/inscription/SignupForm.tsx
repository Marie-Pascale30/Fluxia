'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signup } from '@/app/auth-actions';

export function SignupForm() {
    const [state, action, pending] = useActionState(signup, null);
    const values = state?.values;

    return (
        <form action={action} className="form">
            <label>
                Nom de l’entreprise
                <input name="organizationName" className="input" required minLength={2} maxLength={120} autoComplete="organization" defaultValue={values?.organizationName} autoFocus />
            </label>
            <label>
                Votre nom
                <input name="name" className="input" required minLength={2} maxLength={120} autoComplete="name" defaultValue={values?.name} />
            </label>
            <label>
                Email professionnel
                <input name="email" type="email" className="input" required autoComplete="username" defaultValue={values?.email} />
            </label>
            <label>
                Mot de passe (8 caractères minimum)
                <input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
            </label>
            <label>
                Confirmation du mot de passe
                <input name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" />
            </label>
            <label className="row-flex small">
                <input name="acceptTerms" type="checkbox" required />
                <span>
                    J’accepte les <Link href="/conditions" target="_blank">conditions d’utilisation</Link> et la{' '}
                    <Link href="/confidentialite" target="_blank">politique de confidentialité</Link>.
                </span>
            </label>
            {state?.error && (
                <div className="form-error" role="alert">
                    {state.error}
                </div>
            )}
            <button className="btn" disabled={pending}>
                {pending ? 'Création…' : 'Créer mon espace'}
            </button>
        </form>
    );
}
