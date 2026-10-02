'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { homeFor, SESSION_COOKIE } from '@/lib/session';

export interface LoginState {
    error?: string;
}

/** N'accepte que des chemins internes (évite les redirections ouvertes). */
const safeNext = (value: FormDataEntryValue | null) =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;

export async function login(_: LoginState | null, form: FormData): Promise<LoginState> {
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    let target: string;
    try {
        const { token, expiresIn, user } = await api.auth.login(email, password);
        (await cookies()).set(SESSION_COOKIE, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: expiresIn,
        });
        const next = safeNext(form.get('next'));
        target = user.role === 'TECHNICIAN' || !next ? homeFor(user) : next;
    } catch (error) {
        if (error instanceof ApiError) {
            return { error: error.status === 429 ? 'Trop de tentatives, réessayez dans une minute.' : error.message };
        }
        return { error: 'Connexion impossible pour le moment.' };
    }
    redirect(target);
}

export async function logout() {
    (await cookies()).delete(SESSION_COOKIE);
    redirect('/login');
}
