import { execSync, spawn, type ChildProcess } from 'node:child_process';

// Avant la suite : schéma à jour, données de démo, puis démarrage de l'API compilée
// (exactement comme en production) sur un port dédié. Les tests l'interrogent en HTTP.
export const E2E_PORT = Number(process.env.E2E_API_PORT ?? 4100);

async function isUp() {
    try {
        return (await fetch(`http://localhost:${E2E_PORT}/api/health`)).ok;
    } catch {
        return false;
    }
}

export default async function setup() {
    if (await isUp()) {
        throw new Error(`Le port ${E2E_PORT} est déjà utilisé (ancienne API de test ?). Arrêtez-la ou définissez E2E_API_PORT.`);
    }

    const env = {
        ...process.env,
        DATABASE_URL:
            process.env.TEST_DATABASE_URL ?? 'postgresql://fluxia:fluxia@localhost:5434/fluxia_test?schema=public',
        APP_TIMEZONE: 'Europe/Paris',
        AI_PROVIDER: 'heuristic',
        GEOCODER: 'none',
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
    while (!(await isUp())) {
        if (server.exitCode !== null) throw new Error(`L'API s'est arrêtée au démarrage :\n${output}`);
        if (Date.now() > deadline) {
            server.kill();
            throw new Error(`L'API n'a pas démarré en 60 s :\n${output}`);
        }
        await new Promise((r) => setTimeout(r, 300));
    }

    return async () => {
        server.kill();
        await new Promise((resolve) => server.once('exit', resolve));
    };
}
