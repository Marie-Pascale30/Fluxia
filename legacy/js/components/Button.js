import { html, cx } from '../core/html.js';

/**
 * Bouton d'action ou lien de navigation.
 * - `href`   : id de page → rend un <a href="#/page">
 * - `action` : nom d'une action de state/actions.js
 * - `data`   : attributs data-* transmis à l'action
 * @param {{ label: string, variant?: 'light'|'ai'|'green', action?: string, href?: string,
 *           disabled?: boolean, data?: Record<string, string> }} props
 */
export function Button({ label, variant, action, href, disabled = false, data = {} }) {
    const className = cx('btn', variant);
    if (href) return html`<a class="${className}" href="#/${href}">${label}</a>`;

    const dataAttrs = Object.entries({ action, ...data })
        .filter(([, value]) => value != null)
        .map(([key, value]) => html` data-${key}="${value}"`);

    return html`<button type="button" class="${className}"${dataAttrs}${disabled ? html` disabled` : ''}>${label}</button>`;
}

/** Libellé "✓ ..." une fois l'étape réalisée. */
export const doneLabel = (done, todo, doneText) => (done ? `✓ ${doneText}` : todo);
