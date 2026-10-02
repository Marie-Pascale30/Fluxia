import { proxyFile } from '@/lib/api-file';

/** Photo, signature ou audio d'une intervention. */
export async function GET(_: Request, { params }: RouteContext<'/files/[id]'>) {
    const { id } = await params;
    return proxyFile(`/attachments/${encodeURIComponent(id)}/file`);
}
