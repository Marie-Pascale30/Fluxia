import { render } from './core/html.js';
import { createRouter } from './core/router.js';
import { createStore } from './core/store.js';
import { createToast } from './core/toast.js';
import { Sidebar } from './layout/Sidebar.js';
import { Topbar } from './layout/Topbar.js';
import { ModalHost } from './modals/index.js';
import { getPage, pages } from './pages/index.js';
import { actions } from './state/actions.js';
import { initialState } from './state/initialState.js';

const NAVIGATION_DELAY = 450;

const $ = (selector) => document.querySelector(selector);
const root = {
    sidebar: $('#sidebar'),
    topbar: $('#topbar'),
    content: $('#content'),
    modal: $('#modal-root'),
};

const store = createStore(initialState);
const toast = createToast($('#toast'));

const router = createRouter({
    routes: pages.map((p) => p.id),
    defaultRoute: 'home',
    onChange(page) {
        store.set({ page, modal: null });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
});

const ctx = {
    store,
    toast,
    navigate: router.navigate,
    navigateLater: (page) => setTimeout(() => router.navigate(page), NAVIGATION_DELAY),
};

function renderApp(state) {
    render(root.sidebar, Sidebar(state));
    render(root.topbar, Topbar(state));
    render(root.content, getPage(state.page).render(state));
    render(root.modal, ModalHost(state));
}

// Délégation d'événements : un seul listener pour tous les [data-action]
document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    if ('backdrop' in el.dataset && event.target !== el) return; // clic à l'intérieur de la modale

    const action = actions[el.dataset.action];
    if (!action) return console.warn(`Action inconnue : ${el.dataset.action}`);
    event.preventDefault();
    action(ctx, { ...el.dataset }, event);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && store.get().modal) actions.closeModal(ctx);
});

store.subscribe(renderApp);
router.start();
