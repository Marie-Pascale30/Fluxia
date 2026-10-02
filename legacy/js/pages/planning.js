import { html } from '../core/html.js';
import { Calendar, Card, Notice, PageHeader, Pill, Row } from '../components/index.js';
import { intervention } from '../data/interventions.js';
import { planning } from '../data/planning.js';
import { getTechnician } from '../data/technicians.js';
import { selectRecommendedTechnician } from '../state/selectors.js';

export default {
    id: 'planning',
    nav: 'Planning',

    render({ workflow }) {
        const tech = selectRecommendedTechnician();
        const technicians = planning.technicianIds.map(getTechnician);

        // Une fois affecté, le créneau de l'intervention affiche le technicien
        const slots = planning.slots.map((slot) =>
            workflow.assigned && slot.interventionId === intervention.id
                ? { ...slot, client: `${tech.firstName} → Restaurant` }
                : slot
        );

        return html`
            ${PageHeader({ title: 'Planning', subtitle: 'Le planning reflète les décisions prises dans le parcours.' })}
            ${workflow.assigned
                ? Notice({
                      children: html`<b>Planning mis à jour.</b>
                          ${tech.name} a été affecté à #${intervention.id} à ${intervention.slot.short}.`,
                  })
                : ''}
            ${Card({ className: 'scroll-x', children: Calendar({ technicians, timeRows: planning.timeRows, slots }) })}
            ${Card({
                className: 'mt-16',
                title: 'Suggestion IA',
                children: Row({
                    title: `${tech.firstName} peut prendre #${intervention.id} à ${intervention.slot.short}`,
                    subtitle: 'Compétence + disponibilité + historique client',
                    aside: Pill({ label: 'Recommandé', tone: 'green' }),
                }),
            })}`;
    },
};
