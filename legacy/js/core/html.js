// Mini moteur de templates : échappe automatiquement les valeurs interpolées
// (protection XSS) sauf celles déjà produites par html`` ou raw().

const RAW = Symbol('raw');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (str) => str.replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const raw = (value) => ({ [RAW]: true, value: String(value) });

function toHtml(value) {
    if (value == null || value === false) return '';
    if (Array.isArray(value)) return value.map(toHtml).join('');
    if (value[RAW]) return value.value;
    return escape(String(value));
}

export function html(strings, ...values) {
    let out = strings[0];
    values.forEach((value, i) => { out += toHtml(value) + strings[i + 1]; });
    return raw(out);
}

export function render(container, view) {
    container.innerHTML = toHtml(view);
}

export const cx = (...classes) => classes.filter(Boolean).join(' ');
