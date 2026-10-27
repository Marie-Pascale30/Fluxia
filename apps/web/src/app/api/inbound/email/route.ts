// Relais du webhook d'emails entrants vers l'API : en production, seul le web est exposé.
// L'URL à donner au fournisseur d'emails est donc celle du site (voir Paramètres).
const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

export async function POST(request: Request) {
    const { search } = new URL(request.url);
    const token = request.headers.get('x-fluxia-token');
    const upstream = await fetch(`${API_URL}/inbound/email${search}`, {
        method: 'POST',
        headers: {
            'content-type': request.headers.get('content-type') ?? 'application/json',
            ...(token ? { 'x-fluxia-token': token } : {}),
        },
        body: await request.arrayBuffer(),
        cache: 'no-store',
    }).catch(() => null);
    if (!upstream) return Response.json({ message: 'Service momentanément indisponible' }, { status: 503 });
    return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' } });
}
