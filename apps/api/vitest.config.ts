import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: { tsconfigPaths: true },
    test: {
        globals: true,
        root: './',
        include: ['src/**/*.spec.ts'],
        // Fuseau serveur volontairement différent du fuseau métier : les calculs
        // d'horaires doivent rester justes quel que soit l'hébergement.
        env: { TZ: 'America/New_York', APP_TIMEZONE: 'Europe/Paris' },
    },
});
