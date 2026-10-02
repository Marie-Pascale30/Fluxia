import { html } from '../core/html.js';
import { Button, Card, EmailItem, Field, KeyValue, Notice, PageHeader, Pill, doneLabel } from '../components/index.js';
import { getClient } from '../data/clients.js';
import { emails } from '../data/emails.js';
import { intervention } from '../data/interventions.js';
import { selectCounters } from '../state/selectors.js';

export default {
    id: 'inbox',
    nav: 'Inbox IA',
    badge: (state) => selectCounters(state).inboxPending,

    render({ workflow }) {
        const client = getClient(intervention.clientId);

        return html`
            ${PageHeader({ title: 'Inbox IA', subtitle: 'Une demande entrante devient une action structurée.' })}
            <div class="two">
                <div>
                    ${emails.map((email) => EmailItem({ email, selected: email.id === intervention.emailId }))}
                </div>
                ${Card({
                    variant: 'detail',
                    children: html`
                        ${Pill({ label: 'Analyse IA terminée', tone: 'blue' })}
                        <h2>${intervention.title}</h2>
                        ${Notice({ title: 'Ce que Fluxia a compris', children: intervention.aiUnderstanding })}
                        ${KeyValue({
                            items: [
                                ['Client', client.name],
                                ['Site', client.address],
                                ['Équipement', intervention.equipment],
                                ['Contrat', 'Maintenance active'],
                            ],
                        })}
                        ${Field({ label: 'Action proposée', value: intervention.proposedAction })}
                        ${Button({
                            label: doneLabel(workflow.created, "Créer l'intervention", 'Intervention créée'),
                            variant: 'ai',
                            action: 'createIntervention',
                            disabled: workflow.created,
                        })}
                        ${Button({
                            label: "Voir l'email",
                            variant: 'light',
                            action: 'openModal',
                            data: { modal: 'email', id: intervention.emailId },
                        })}`,
                })}
            </div>`;
    },
};
