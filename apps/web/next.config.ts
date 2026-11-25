import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Politique de sécurité du contenu, pragmatique : Next injecte des scripts en ligne (hydratation),
 * d'où 'unsafe-inline' pour les scripts sans nonce ; tout le reste est limité au site lui-même.
 * Le navigateur ne parle jamais directement à l'API (Server Actions et routes du web).
 */
const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // Photos et signatures servies par /files ; aperçus locaux (blob:) et signature dessinée (data:)
    "img-src 'self' data: blob:",
    // Enregistrements audio du compte rendu
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Paiement Stripe (Checkout et portail client) atteint après une action de formulaire
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Vue terrain : appareil photo (photos de chantier) et micro (dictée, enregistrement) pour le site lui-même.
    // La géolocalisation n'est pas utilisée par l'application : désactivée.
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
    poweredByHeader: false,
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
            { source: '/:path*', headers: securityHeaders },
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
