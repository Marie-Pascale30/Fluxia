import { defineConfig, devices } from '@playwright/test';

// Tests navigateur de bout en bout. Prérequis : API et web démarrés sur une base
// fraîchement peuplée (npm run db:seed), cf. README.
// En local, PW_CHANNEL=msedge évite de télécharger un navigateur.
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
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
