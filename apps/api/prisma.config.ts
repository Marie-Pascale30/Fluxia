import { defineConfig } from 'prisma/config';

// Avec un fichier de configuration, Prisma ne lit plus .env automatiquement :
// on le charge ici (sans écraser les variables déjà définies, ex. en CI).
try {
    process.loadEnvFile('.env');
} catch {
    // pas de .env : variables fournies par l'environnement
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
});
