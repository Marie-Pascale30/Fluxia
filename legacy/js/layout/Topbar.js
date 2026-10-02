import { html } from '../core/html.js';
import { Avatar } from '../components/index.js';
import { currentUser } from '../data/dashboard.js';
import { getPage } from '../pages/index.js';

export function Topbar(state) {
    const page = getPage(state.page);
    return html`
        <div><b>Fluxia</b> <span class="crumb">/ ${page.title ?? page.nav}</span></div>
        ${Avatar({ initials: currentUser.initials })}`;
}
