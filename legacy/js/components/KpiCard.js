import { html } from '../core/html.js';

export const KpiCard = ({ label, value, hint }) => html`
    <div class="card">
        <div class="muted">${label}</div>
        <div class="kpi">${value}</div>
        <div class="muted">${hint}</div>
    </div>`;
