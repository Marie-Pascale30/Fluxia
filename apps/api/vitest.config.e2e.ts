import { defineConfig } from 'vitest/config';

// Tests de bout en bout : base PostgreSQL dédiée, réinitialisée et peuplée avant l'exécution.
const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? 'postgresql://fluxia:fluxia@localhost:5434/fluxia_test?schema=public';

export default defineConfig({
    test: {
        globals: true,
        include: ['test/**/*.e2e-spec.ts'],
        globalSetup: ['test/global-setup.ts'],
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 120_000,
        env: {
            DATABASE_URL: TEST_DATABASE_URL,
            TZ: 'America/New_York',
            APP_TIMEZONE: 'Europe/Paris',
            AI_PROVIDER: 'heuristic',
            ANTHROPIC_API_KEY: '',
        },
    },
});
