import { html } from '../core/html.js';
import { Avatar } from './Avatar.js';
import { Pill } from './Pill.js';

export const TechnicianItem = ({ technician: t }) => html`
    <div class="tech">
        ${Avatar({ initials: t.initials })}
        <div class="grow">
            <b>${t.name}</b>
            <div class="muted">${t.skill} · ${t.interventionsToday} interventions</div>
        </div>
        ${Pill(t.availability)}
    </div>`;
