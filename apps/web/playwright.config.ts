import { defineConfig, devices } from '@playwright/test';

// Tests navigateur de bout en bout, sur une pile isolée (cf. README) :
//   node scripts/e2e-api.mjs                     → API de test sur :4005 (base fluxia_e2e)
//   API_URL=http://localhost:4005/api next dev -p 3005
// La base de test est réinitialisée avant chaque exécution (e2e/global-setup.ts).
// En local, PW_CHANNEL=msedge évite de télécharger un navigateur.
export default defineConfig({
    testDir: './e2e',
    globalSetup: './e2e/global-setup.ts',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3005',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL, viewport: { width: 1440, height: 1000 } },
        },
    ],
});
