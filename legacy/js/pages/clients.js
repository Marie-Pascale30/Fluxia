import { html } from '../core/html.js';
import { Button, Card, PageHeader, Row } from '../components/index.js';
import { clients } from '../data/clients.js';

const ClientRow = (client) => Row({
    title: client.name,
    subtitle: client.summary,
    aside: client.hasDetail
        ? Button({ label: 'Voir la fiche', variant: 'light', action: 'openModal', data: { modal: 'client', id: client.id } })
        : Button({ label: 'Voir', variant: 'light', action: 'toast', data: { message: 'Fiche client ouverte — simulation' } }),
});

export default {
    id: 'clients',
    nav: 'Clients',

    render() {
        return html`
            ${PageHeader({ title: 'Clients', subtitle: "L'historique devient directement exploitable par l'IA." })}
            ${Card({ children: Object.values(clients).map(ClientRow) })}`;
    },
};
