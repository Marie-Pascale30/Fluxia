import { html, cx } from '../core/html.js';

/** @param {{ steps: Array<{ label: string, done: boolean }> }} props */
export const Stepper = ({ steps }) => html`
    <div class="flow">
        ${steps.map((step, i) => html`
            ${i > 0 ? html`<span>→</span>` : ''}
            <span class="${cx('step', step.done && 'done')}">${step.label}</span>`)}
    </div>`;
