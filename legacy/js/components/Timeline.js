import { html } from '../core/html.js';

/** @param {{ events: Array<{ title: string, detail: string }> }} props */
export const Timeline = ({ events }) => html`
    <div class="timeline">
        ${events.map((e) => html`
            <div class="event"><b>${e.title}</b><div class="muted">${e.detail}</div></div>`)}
    </div>`;
