import type { MetadataRoute } from 'next';

/** Application installable (écran d'accueil du téléphone des techniciens). */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Fluxia',
        short_name: 'Fluxia',
        description: 'Le bureau administratif IA des entreprises de maintenance.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#101827',
        theme_color: '#101827',
        lang: 'fr',
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}
