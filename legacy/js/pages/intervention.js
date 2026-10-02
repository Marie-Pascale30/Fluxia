import { html } from '../core/html.js';
import { Button, Card, Field, KeyValue, Notice, PageHeader, Pill, Stepper, Timeline, doneLabel } from '../components/index.js';
import { getClient } from '../data/clients.js';
import { intervention } from '../data/interventions.js';
import { selectInterventionSteps, selectRecommendedTechnician } from '../state/selectors.js';

export default {
    id: 'intervention',
    nav: 'Intervention',
    title: `Intervention #${intervention.id}`,

    render(state) {
        const { assigned } = state.workflow;
        const client = getClient(intervention.clientId);
        const tech = selectRecommendedTechnician();

        return html`
            ${PageHeader({ title: `Intervention #${intervention.id}`, subtitle: `${client.name} · ${intervention.title}` })}
            ${Stepper({ steps: selectInterventionSteps(state) })}
            <div class="two">
                ${Card({
                    variant: 'detail',
                    children: html`
                        ${Pill(intervention.priority)}
                        <h2>Détails</h2>
                        ${KeyValue({
                            items: [
                                ['Client', client.name],
                                ['Adresse', client.address],
                                ['Problème', intervention.problem],
                                ['Créneau', assigned ? intervention.slot.label : 'À proposer'],
                                ['Technicien', assigned ? tech.name : 'À affecter'],
                            ],
                        })}
                        ${Field({ label: 'Diagnostic initial IA', value: intervention.initialDiagnosis })}
                        ${Button({
                            label: doneLabel(assigned, `Affecter ${tech.name}`, `${tech.name} affecté`),
                            variant: 'ai',
                            action: 'assignTechnician',
                            disabled: assigned,
                        })}
                        ${Button({ label: 'Voir le planning', variant: 'light', href: 'planning' })}`,
                })}
                ${Card({
                    variant: 'detail',
                    children: html`
                        ${Pill({ label: `Pourquoi ${tech.firstName} ?`, tone: 'blue' })}
                        ${Timeline({ events: intervention.recommendationReasons })}
                        ${Notice({ children: "Fluxia propose l'affectation. Le responsable valide avant envoi." })}`,
                })}
            </div>`;
    },
};
