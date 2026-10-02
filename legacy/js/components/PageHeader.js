import { html } from '../core/html.js';

export const PageHeader = ({ title, subtitle }) => html`
    <h1 class="h1">${title}</h1>
    ${subtitle ? html`<div class="sub">${subtitle}</div>` : ''}`;
