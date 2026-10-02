import { html } from '../core/html.js';
import { Button, Card, KeyValue, Notice, PageHeader, Pill, TechnicianItem, doneLabel } from '../components/index.js';
import { getClient } from '../data/clients.js';
import { intervention } from '../data/interventions.js';
import { technicians } from '../data/technicians.js';
import { selectRecommendedTechnician } from '../state/selectors.js';

export default {
    id: 'techniciens',
    nav: 'Techniciens',

    render({ workflow }) {
        const tech = selectRecommendedTechnician();
        const client = getClient(intervention.clientId);

        return html`
            ${PageHeader({ title: 'Techniciens', subtitle: 'Le contexte utile est préparé pour le terrain.' })}
            <div class="two">
                ${Card({ children: technicians.map((technician) => TechnicianItem({ technician })) })}
                ${Card({
                    variant: 'detail',
                    children: html`
                        ${Pill({ label: `Mission #${intervention.id}`, tone: 'blue' })}
                        <h2>${tech.firstName} — ${intervention.slot.short}</h2>
                        ${KeyValue({
                            items: [
                                ['Client', client.name],
                                ['Problème', intervention.title],
                                ['Adresse', client.address],
                                ['Historique', client.historyLabel],
                            ],
                        })}
                        ${Notice({
                            children: 'La mission est prête. Une fois envoyée, elle apparaîtra dans la vue mobile du technicien.',
                        })}
                        ${Button({
                            label: doneLabel(workflow.sent, `Envoyer la mission à ${tech.firstName}`, 'Mission envoyée'),
                            variant: 'green',
                            action: 'sendMission',
                            disabled: workflow.sent,
                        })}`,
                })}
            </div>`;
    },
};
