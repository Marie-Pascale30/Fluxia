import { html } from '../core/html.js';

/** Ligne de liste : titre + sous-titre à gauche, élément libre à droite. */
export const Row = ({ title, subtitle, aside }) => html`
    <div class="row">
        <div class="row-main">
            <div class="row-title">${title}</div>
            ${subtitle ? html`<div class="muted">${subtitle}</div>` : ''}
        </div>
        ${aside}
    </div>`;
