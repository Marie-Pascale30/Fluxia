import { execSync, spawn, type ChildProcess } from 'node:child_process';

// Avant la suite : schéma à jour, données de démo, puis démarrage de l'API compilée
// (exactement comme en production) sur un port dédié. Les tests l'interrogent en HTTP.
export const E2E_PORT = Number(process.env.E2E_API_PORT ?? 4100);

export default async function setup() {
    const env = {
        ...process.env,
        DATABASE_URL:
            process.env.TEST_DATABASE_URL ?? 'postgresql://fluxia:fluxia@localhost:5434/fluxia_test?schema=public',
        APP_TIMEZONE: 'Europe/Paris',
        AI_PROVIDER: 'heuristic',
        ANTHROPIC_API_KEY: '',
        PORT: String(E2E_PORT),
    };

    execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
    execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
    if (!process.env.E2E_SKIP_BUILD) execSync('npx nest build', { env, stdio: 'pipe' });

    const server: ChildProcess = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'pipe' });
    let output = '';
    server.stdout?.on('data', (chunk) => (output += chunk));
    server.stderr?.on('data', (chunk) => (output += chunk));

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`http://localhost:${E2E_PORT}/api/health`);
            if (res.ok) break;
        } catch {
            // pas encore prêt
        }
        if (server.exitCode !== null) throw new Error(`L'API s'est arrêtée au démarrage :\n${output}`);
        await new Promise((r) => setTimeout(r, 300));
    }

    return () => {
        server.kill();
    };
}
