import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Fluxia doit pouvoir être hébergé dans un conteneur autonome (voir Dockerfile)
    output: 'standalone',
    experimental: {
        // Photos de chantier et enregistrements audio envoyés via Server Actions
        serverActions: { bodySizeLimit: '26mb' },
        proxyClientMaxBodySize: '26mb',
    },
};

export default nextConfig;
