import { html } from '../core/html.js';

/** @param {{ items: Array<[string, any]> }} props */
export const KeyValue = ({ items }) => html`
    <div class="kv">
        ${items.map(([key, value]) => html`<div class="k">${key}</div><div>${value}</div>`)}
    </div>`;
