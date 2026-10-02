import { html } from '../core/html.js';

export const Field = ({ label, value }) => html`
    <div class="field">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
    </div>`;
