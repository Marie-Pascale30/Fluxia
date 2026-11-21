'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, type LoginResult } from '@/lib/api';
import { homeFor, SESSION_COOKIE } from '@/lib/session';

export interface LoginState {
    error?: string;
}

/** N'accepte que des chemins internes (évite les redirections ouvertes). */
const safeNext = (value: FormDataEntryValue | null) =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;

async function openSession({ token, expiresIn }: LoginResult) {
    (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: expiresIn,
    });
}

export async function login(_: LoginState | null, form: FormData): Promise<LoginState> {
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    let target: string;
    try {
        const session = await api.auth.login(email, password);
        await openSession(session);
        const { user } = session;
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

export interface SignupState {
    error?: string;
    /** Valeurs saisies, réaffichées après une erreur */
    values?: Record<string, string>;
}

/** Inscription : crée l'entreprise et son compte responsable, puis ouvre la session. */
export async function signup(_: SignupState | null, form: FormData): Promise<SignupState> {
    const values = {
        organizationName: String(form.get('organizationName') ?? '').trim(),
        name: String(form.get('name') ?? '').trim(),
        email: String(form.get('email') ?? '').trim(),
    };
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirm') ?? '')) return { error: 'Les deux mots de passe ne correspondent pas.', values };

    try {
        await openSession(await api.auth.signup({ ...values, password }));
    } catch (error) {
        if (error instanceof ApiError) {
            return { error: error.status === 429 ? 'Trop de tentatives, réessayez dans une minute.' : error.message, values };
        }
        return { error: 'Inscription impossible pour le moment.', values };
    }
    redirect('/parametres?bienvenue=1');
}

export interface PasswordState {
    error?: string;
    message?: string;
}

/** Demande de lien de réinitialisation (même réponse que le compte existe ou non). */
export async function forgotPassword(_: PasswordState | null, form: FormData): Promise<PasswordState> {
    try {
        const { message } = await api.auth.forgotPassword(String(form.get('email') ?? '').trim());
        return { message };
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) return { error: 'Trop de tentatives, réessayez dans une minute.' };
        return { error: error instanceof ApiError ? error.message : 'Envoi impossible pour le moment.' };
    }
}

/** Nouveau mot de passe depuis le lien reçu : la session s'ouvre directement. */
export async function resetPassword(token: string, _: PasswordState | null, form: FormData): Promise<PasswordState> {
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirm') ?? '')) return { error: 'Les deux mots de passe ne correspondent pas.' };
    let user: LoginResult['user'];
    try {
        const session = await api.auth.resetPassword(token, password);
        await openSession(session);
        user = session.user;
    } catch (error) {
        return { error: error instanceof ApiError ? error.message : 'Réinitialisation impossible pour le moment.' };
    }
    redirect(homeFor(user));
}

/** Changement de mot de passe de l'utilisateur connecté ; ses autres sessions sont fermées. */
export async function changePassword(_: PasswordState | null, form: FormData): Promise<PasswordState> {
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword !== String(form.get('confirm') ?? '')) return { error: 'Les deux mots de passe ne correspondent pas.' };
    try {
        await openSession(await api.auth.changePassword(String(form.get('currentPassword') ?? ''), newPassword));
        return { message: 'Mot de passe modifié. Vos autres sessions ont été fermées.' };
    } catch (error) {
        return { error: error instanceof ApiError ? error.message : 'Modification impossible pour le moment.' };
    }
}

export async function logout() {
    (await cookies()).delete(SESSION_COOKIE);
    redirect('/login');
}
