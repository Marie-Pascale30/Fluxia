import { html, cx } from '../core/html.js';

/**
 * Encadré d'information.
 * @param {{ tone?: 'success'|'warning', title?: string, children?: any }} props
 */
export const Notice = ({ tone, title, children }) => html`
    <div class="${cx('notice', tone)}">
        ${title ? html`<b>${title}</b>` : ''}${title && children ? html`<br>` : ''}${children}
    </div>`;
