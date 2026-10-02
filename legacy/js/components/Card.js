import { html, cx } from '../core/html.js';

/**
 * Conteneur générique.
 * @param {{ variant?: 'card'|'detail', title?: string, className?: string, children: any }} props
 */
export const Card = ({ variant = 'card', title, className, children }) => html`
    <div class="${cx(variant, className)}">
        ${title ? html`<b>${title}</b>` : ''}
        ${children}
    </div>`;
