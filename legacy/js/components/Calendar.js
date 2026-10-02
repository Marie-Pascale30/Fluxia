import { html, cx } from '../core/html.js';

/**
 * Grille planning : une colonne par technicien, une ligne par tranche horaire.
 * @param {{ technicians: Array, timeRows: string[], slots: Array }} props
 */
export function Calendar({ technicians, timeRows, slots }) {
    const slotsAt = (technicianId, row) =>
        slots.filter((s) => s.technicianId === technicianId && s.row === row);

    return html`
        <div class="calendar" style="grid-template-columns: 78px repeat(${technicians.length}, 1fr)">
            <div></div>
            ${technicians.map((t) => html`<div><b>${t.firstName}</b><br><span class="muted">${t.skill}</span></div>`)}
            ${timeRows.map((row) => html`
                <div><b>${row}</b></div>
                ${technicians.map((t) => html`
                    <div>
                        ${slotsAt(t.id, row).map((s) => html`
                            <div class="${cx('slot', s.confirmed && 'ok')}">${s.time} · ${s.type}<br>${s.client}</div>`)}
                    </div>`)}`)}
        </div>`;
}
