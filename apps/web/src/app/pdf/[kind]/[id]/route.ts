import { proxyFile } from '@/lib/api-file';

const SOURCES: Record<string, string> = { rapport: 'reports', devis: 'quotes', facture: 'invoices' };

/** PDF d'un rapport, d'un devis ou d'une facture (?download=1 pour télécharger). */
export async function GET(request: Request, { params }: RouteContext<'/pdf/[kind]/[id]'>) {
    const { kind, id } = await params;
    const source = SOURCES[kind];
    if (!source) return new Response('Introuvable', { status: 404 });
    const download = new URL(request.url).searchParams.has('download') ? `${kind}-${id}.pdf` : undefined;
    return proxyFile(`/${source}/${encodeURIComponent(id)}/pdf`, download);
}
