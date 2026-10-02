// Démarre une API isolée pour les tests navigateur (Playwright) :
// base dédiée réinitialisée, build séparé (dist-e2e) pour ne pas gêner `npm run dev`.
//   node scripts/e2e-api.mjs            → API sur http://localhost:4005
// Variables : E2E_DATABASE_URL, E2E_API_PORT, E2E_WEB_URL
import { execSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const api = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/api');
const port = process.env.E2E_API_PORT ?? '4005';
const env = {
    ...process.env,
    DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgresql://fluxia:fluxia@localhost:5434/fluxia_e2e?schema=public',
    PORT: port,
    APP_TIMEZONE: 'Europe/Paris',
    AI_PROVIDER: 'heuristic',
    ANTHROPIC_API_KEY: '',
    GEOCODER: 'none',
    SMTP_URL: '',
    TWILIO_ACCOUNT_SID: '',
    IMAP_URL: '',
    TRANSCRIPTION_URL: '',
    MAINTENANCE_AUTO: 'false',
    UPLOAD_DIR: 'storage-e2e',
    LOGIN_RATE_LIMIT: '1000',
    WEB_ORIGIN: process.env.E2E_WEB_URL ?? 'http://localhost:3005',
    PUBLIC_WEB_URL: process.env.E2E_WEB_URL ?? 'http://localhost:3005',
};

const run = (cmd) => execSync(cmd, { cwd: api, env, stdio: 'inherit' });
run('npx prisma migrate deploy');
run('npx tsx prisma/seed.ts');
run('npx tsc -p tsconfig.build.json --outDir dist-e2e');

const server = spawn(process.execPath, ['dist-e2e/main.js'], { cwd: api, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill());
server.on('exit', (code) => process.exit(code ?? 0));
