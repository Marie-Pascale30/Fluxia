import type { z } from 'zod';

const BASE = `http://localhost:${process.env.E2E_API_PORT ?? 4100}/api`;

export interface Res<T = any> {
    status: number;
    body: T;
}

export async function call<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res<T>> {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
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
