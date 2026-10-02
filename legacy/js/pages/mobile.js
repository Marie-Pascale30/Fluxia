import { html } from '../core/html.js';
import { Button, Card, KeyValue, PageHeader, Pill } from '../components/index.js';
import { getClient } from '../data/clients.js';
import { intervention } from '../data/interventions.js';

export default {
    id: 'mobile',
    nav: 'Vue technicien',

    render({ voiceNote }) {
        const client = getClient(intervention.clientId);

        return html`
            ${PageHeader({ title: 'Vue technicien', subtitle: "Simulation de l'expérience terrain." })}
            <div class="two">
                ${Card({
                    variant: 'detail',
                    children: html`
                        ${Pill({ label: `Mission #${intervention.id} · ${intervention.slot.short}`, tone: 'blue' })}
                        <h2>${client.name}</h2>
                        ${KeyValue({
                            items: [
                                ['Adresse', client.address],
                                ['Équipement', intervention.equipment],
                                ['Problème', intervention.problem],
                            ],
                        })}
                        ${Button({
                            label: "Ouvrir l'itinéraire",
                            variant: 'light',
                            action: 'toast',
                            data: { message: 'Itinéraire ouvert — simulation' },
                        })}`,
                })}
                ${Card({
                    variant: 'detail',
                    children: html`
                        <h2>Compte rendu vocal</h2>
                        <p class="muted">Le technicien parle naturellement. Fluxia transforme ensuite la note en rapport.</p>
                        <textarea id="voice-note" class="textarea">${voiceNote}</textarea>
                        ${Button({ label: '✨ Générer le rapport', variant: 'ai', action: 'generateReport' })}`,
                })}
            </div>`;
    },
};
