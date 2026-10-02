const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';
const SOURCES: Record<string, string> = { rapport: 'reports', devis: 'quotes' };

/** PDF accessible depuis l'espace client (lien signé vérifié par l'API). */
export async function GET(_: Request, { params }: RouteContext<'/portail/[token]/pdf/[kind]/[id]'>) {
    const { token, kind, id } = await params;
    const source = SOURCES[kind];
    if (!source) return new Response('Introuvable', { status: 404 });

    const upstream = await fetch(`${API_URL}/portal/${encodeURIComponent(token)}/${source}/${encodeURIComponent(id)}/pdf`, { cache: 'no-store' });
    if (!upstream.ok) return new Response('Document introuvable', { status: upstream.status === 404 ? 404 : 502 });
    return new Response(upstream.body, {
        headers: {
            'content-type': 'application/pdf',
            'content-disposition': upstream.headers.get('content-disposition') ?? 'inline',
            'cache-control': 'private, no-store',
        },
    });
}
