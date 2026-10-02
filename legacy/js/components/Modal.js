import { html } from '../core/html.js';
import { Pill } from './Pill.js';

/** Coquille de modale : fermeture via la croix, le fond ou la touche Échap. */
export const Modal = ({ tag, title, children }) => html`
    <div class="modal-back" data-action="closeModal" data-backdrop>
        <div class="modal" role="dialog" aria-modal="true">
            <div class="modal-head">
                <div>
                    ${tag ? Pill(tag) : ''}
                    <h2>${title}</h2>
                </div>
                <button type="button" class="x" data-action="closeModal" aria-label="Fermer">×</button>
            </div>
            ${children}
        </div>
    </div>`;
