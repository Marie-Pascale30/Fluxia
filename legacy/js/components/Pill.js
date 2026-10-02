import { html, cx } from '../core/html.js';

/** @param {{ label: string, tone?: 'red'|'green'|'blue'|'orange' }} props */
export const Pill = ({ label, tone }) => html`<span class="${cx('pill', tone)}">${label}</span>`;
