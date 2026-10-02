// Chargé en premier par main.ts : rend les variables de .env disponibles
// avant l'instanciation de Prisma (le client généré ne lit plus .env lui-même).
try {
    process.loadEnvFile('.env');
} catch {
    // Pas de fichier .env : variables fournies par l'environnement (CI, prod…)
}
