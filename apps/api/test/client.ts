import type { z } from 'zod';

const BASE = `http://localhost:${process.env.E2E_API_PORT ?? 4610}/api`;

export interface Res<T = any> {
    status: number;
    body: T;
}

let session: string | null = null;

/** Jeton utilisé par défaut pour les appels suivants (null = anonyme). */
export const useToken = (token: string | null) => (session = token);

export const DEMO_PASSWORD = 'fluxia-demo';

export async function login(email: string, password = DEMO_PASSWORD): Promise<string> {
    const res = await call<{ token: string }>('POST', '/auth/login', { email, password }, { token: null });
    if (res.status !== 200) throw new Error(`Connexion impossible pour ${email} (${res.status})`);
    return res.body.token;
}

export async function call<T = any>(
    method: string,
    path: string,
    body?: unknown,
    options: { token?: string | null; headers?: Record<string, string> } = {},
): Promise<Res<T>> {
    const token = options.token === undefined ? session : options.token;
    const res = await fetch(BASE + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

/** Vérifie qu'une réponse respecte le contrat partagé ; message détaillé sinon. */
export function expectContract<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
    const result = schema.safeParse(value);
    if (!result.success) {
        const issues = result.error.issues.map((i) => `  • ${i.path.join('.') || '(racine)'} : ${i.message}`).join('\n');
        throw new Error(`Réponse non conforme au contrat :\n${issues}`);
    }
    return result.data;
}
