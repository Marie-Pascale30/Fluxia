import { cookies } from 'next/headers';
import { SESSION_COOKIE } from './session';

const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

/**
 * Relaie un fichier binaire de l'API (photo, PDF) vers le navigateur.
 * Le jeton reste côté serveur ; l'API vérifie les droits d'accès.
 */
export async function proxyFile(path: string, download?: string): Promise<Response> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return new Response('Non authentifié', { status: 401 });

    const upstream = await fetch(`${API_URL}${path}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!upstream.ok) return new Response(upstream.status === 404 ? 'Introuvable' : 'Accès refusé', { status: upstream.status });

    const headers = new Headers({
        'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'cache-control': upstream.headers.get('cache-control') ?? 'private, no-store',
        'x-content-type-options': 'nosniff',
    });
    const disposition = upstream.headers.get('content-disposition');
    if (download) headers.set('content-disposition', `attachment; filename="${download}"`);
    else if (disposition) headers.set('content-disposition', disposition);
    return new Response(upstream.body, { status: 200, headers });
}
