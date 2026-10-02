import { proxyFile } from '@/lib/api-file';

/** Journal des ventes (CSV) : ?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
    const query = new URLSearchParams(
        Object.entries({ from: valid(searchParams.get('from')), to: valid(searchParams.get('to')) }).filter((e): e is [string, string] => !!e[1]),
    );
    return proxyFile(`/invoices/export?${query}`);
}
