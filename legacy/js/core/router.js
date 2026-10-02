// Routeur basé sur le hash (#/inbox) : fonctionne sans serveur de routes
// et gère le bouton "précédent" du navigateur.

export function createRouter({ routes, defaultRoute, onChange }) {
    const current = () => {
        const id = location.hash.replace(/^#\/?/, '');
        return routes.includes(id) ? id : defaultRoute;
    };

    const sync = () => onChange(current());

    return {
        start() {
            window.addEventListener('hashchange', sync);
            sync();
        },
        navigate(id) {
            if (current() === id) sync();
            else location.hash = `/${id}`;
        },
    };
}
