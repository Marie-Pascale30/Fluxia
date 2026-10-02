import { Modal, KeyValue } from '../components/index.js';
import { getClient } from '../data/clients.js';

export function ClientModal({ id }) {
    const client = getClient(id);
    if (!client) return '';

    return Modal({
        tag: { label: 'Client actif', tone: 'green' },
        title: client.name,
        children: KeyValue({
            items: [
                ['Contrat', client.contract],
                ['Équipements', client.equipmentCount],
                ['Interventions', client.interventionsLabel],
                ['Dernière', client.lastIntervention],
            ],
        }),
    });
}
