// Service worker Fluxia : rend la vue terrain consultable sans réseau.
// - Ressources statiques (_next/static, icônes) : cache d'abord (fichiers versionnés).
// - Pages de la vue terrain : réseau d'abord, dernière version en cache si hors ligne.
// Les envois (Server Actions) ne sont jamais mis en cache : Next les rejoue au retour du réseau.
const VERSION = 'fluxia-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

const isStatic = (url) => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
const isFieldPage = (url) => url.pathname.startsWith('/techniciens/') || url.pathname.startsWith('/rapports/');

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isStatic(url)) {
        event.respondWith(
            caches.open(STATIC).then(async (cache) => {
                const cached = await cache.match(request);
                if (cached) return cached;
                const response = await fetch(request);
                if (response.ok) cache.put(request, response.clone());
                return response;
            }),
        );
        return;
    }

    if (request.mode === 'navigate' && isFieldPage(url)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone(); // copie immédiate, avant lecture du corps
                        caches.open(PAGES).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(async () => (await caches.match(request)) ?? Response.error()),
        );
    }
});

// Déconnexion : effacer les pages en cache (données d'un utilisateur)
self.addEventListener('message', (event) => {
    if (event.data === 'clear') event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
});
