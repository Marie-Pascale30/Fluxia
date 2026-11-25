import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Dossier où l'API de test dépose les emails simulés (MAIL_CAPTURE_DIR). */
export const MAIL_CAPTURE_DIR = resolve(import.meta.dirname, '../mail-capture-test');

export interface CapturedEmail {
    to: string;
    subject: string;
    text: string;
}

/** Dernier email simulé reçu par `to` et satisfaisant `match`, en attendant l'envoi en arrière-plan. */
export async function lastEmail(to: string, match: (email: CapturedEmail) => boolean = () => true, after = 0): Promise<CapturedEmail | undefined> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        if (existsSync(MAIL_CAPTURE_DIR)) {
            const found = readdirSync(MAIL_CAPTURE_DIR)
                .filter((f) => Number(f.split('-')[0]) >= after)
                .sort()
                .reverse()
                .map((f) => JSON.parse(readFileSync(join(MAIL_CAPTURE_DIR, f), 'utf8')) as CapturedEmail)
                .find((e) => e.to === to && match(e));
            if (found) return found;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    return undefined;
}
