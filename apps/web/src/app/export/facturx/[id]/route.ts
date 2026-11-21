import { proxyFile } from '@/lib/api-file';

/** Facture électronique seule (XML Factur-X), pour dépôt sur une plateforme agréée. */
export async function GET(_: Request, { params }: RouteContext<'/export/facturx/[id]'>) {
    const { id } = await params;
    return proxyFile(`/invoices/${encodeURIComponent(id)}/facturx`);
}
