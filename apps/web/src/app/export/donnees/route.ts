import { proxyFile } from '@/lib/api-file';

/** Export RGPD : toutes les données de l'entreprise (JSON). */
export async function GET() {
    const day = new Date().toISOString().slice(0, 10);
    return proxyFile('/organization/export', `fluxia-export-${day}.json`);
}
