import { html } from '../core/html.js';
import { Modal } from '../components/index.js';
import { getEmail } from '../data/emails.js';

export function EmailModal({ id }) {
    const email = getEmail(id);
    if (!email) return '';

    const paragraphs = email.body.map((p) => p.split('\n').map((line, i) => html`${i ? html`<br>` : ''}${line}`));

    return Modal({
        tag: { label: 'Email reçu', tone: 'blue' },
        title: email.fullSubject ?? email.subject,
        children: html`<p>${paragraphs.map((p, i) => html`${i ? html`<br><br>` : ''}${p}`)}</p>`,
    });
}
