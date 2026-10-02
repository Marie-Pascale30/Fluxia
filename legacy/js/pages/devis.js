import { html } from '../core/html.js';
import { Button, Card, KeyValue, Notice, PageHeader, Pill, Row } from '../components/index.js';
import { getClient } from '../data/clients.js';
import { intervention } from '../data/interventions.js';
import { draftQuote, quotes } from '../data/quotes.js';
import { selectCounters } from '../state/selectors.js';

const DraftQuote = () => Card({
    variant: 'detail',
    className: 'mb-16',
    children: html`
        ${Pill({ label: 'Brouillon généré', tone: 'green' })}
        <h2>Devis #${draftQuote.number} — ${getClient(draftQuote.clientId).name}</h2>
        <p class="muted">Créé automatiquement depuis le rapport #${intervention.id}. Aucun envoi automatique.</p>
        ${KeyValue({
            items: [
                ['Prestation', draftQuote.service],
                ['Main d’œuvre', draftQuote.labor],
                ['Total HT', html`<b>${draftQuote.totalHT}</b>`],
            ],
        })}
        ${Notice({ tone: 'warning', children: html`<b>À contrôler :</b> ${draftQuote.warning}` })}
        ${Button({ label: 'Valider le devis', variant: 'green', action: 'toast', data: { message: 'Devis validé — prêt à être envoyé' } })}
        ${Button({ label: 'Modifier', variant: 'light', action: 'toast', data: { message: 'Édition du devis — simulation' } })}`,
});

const QuoteRow = (quote) => Row({
    title: quote.title,
    subtitle: quote.subtitle,
    aside: quote.status
        ? Pill(quote.status)
        : Button({ label: 'Générer', variant: 'ai', action: 'toast', data: { message: quote.generateMessage } }),
});

export default {
    id: 'devis',
    nav: 'Devis',
    badge: (state) => selectCounters(state).quotesPending,

    render({ workflow }) {
        return html`
            ${PageHeader({ title: 'Devis', subtitle: 'Les brouillons sont générés, mais jamais envoyés sans validation.' })}
            ${workflow.quote ? DraftQuote() : ''}
            ${Card({ children: quotes.map(QuoteRow) })}`;
    },
};
