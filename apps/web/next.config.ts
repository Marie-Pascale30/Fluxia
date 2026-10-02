import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Fluxia doit pouvoir être hébergé dans un conteneur autonome (voir Dockerfile)
    output: 'standalone',
    // Monorepo : la sortie autonome embarque aussi @fluxia/shared
    outputFileTracingRoot: resolve(process.cwd(), '../..'),
    experimental: {
        // Photos de chantier et enregistrements audio envoyés via Server Actions
        serverActions: { bodySizeLimit: '26mb' },
        proxyClientMaxBodySize: '26mb',
        // Hors ligne : navigations et Server Actions mises en attente puis rejouées au retour du réseau
        useOffline: true,
    },
    async headers() {
        return [
            {
                // Le service worker doit toujours être revalidé
                source: '/sw.js',
                headers: [
                    { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                    { key: 'Service-Worker-Allowed', value: '/' },
                ],
            },
        ];
    },
};

export default nextConfig;
