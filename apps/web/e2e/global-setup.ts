import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Réinitialise la base des tests navigateur avant la suite (données de démo du jour).
 * E2E_RESEED=false pour réutiliser l'état existant.
 */
export default function globalSetup() {
    if (process.env.E2E_RESEED === 'false') return;
    execSync('npx tsx prisma/seed.ts', {
        cwd: resolve(__dirname, '../../api'),
        stdio: 'pipe',
        env: {
            ...process.env,
            DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgresql://fluxia:fluxia@localhost:5434/fluxia_e2e?schema=public',
            APP_TIMEZONE: 'Europe/Paris',
        },
    });
}
