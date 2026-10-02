import { html, cx } from '../core/html.js';
import { Pill } from './Pill.js';

export const EmailItem = ({ email, selected = false }) => html`
    <div class="${cx('email', selected && 'selected')}">
        ${Pill(email.tag)}
        <h3>${email.subject}</h3>
        <p>${email.preview}</p>
        <div class="muted">${email.receivedAt} · ${email.channel}</div>
    </div>`;
