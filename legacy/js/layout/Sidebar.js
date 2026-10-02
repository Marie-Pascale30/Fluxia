import { html, cx } from '../core/html.js';
import { pages } from '../pages/index.js';

export const Sidebar = (state) => html`
    <div class="brand">flux<span>ia</span></div>
    <nav class="nav">
        ${pages.map((page) => html`
            <a class="${cx('nav-item', state.page === page.id && 'active')}" href="#/${page.id}">
                ${page.nav}
                ${page.badge ? html`<span class="count">${page.badge(state)}</span>` : ''}
            </a>`)}
    </nav>`;
