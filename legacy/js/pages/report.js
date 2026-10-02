import { html } from '../core/html.js';
import { Button, Card, Notice, PageHeader, Pill } from '../components/index.js';
import { getClient } from '../data/clients.js';
import { intervention, report } from '../data/interventions.js';
import { selectRecommendedTechnician } from '../state/selectors.js';

export default {
    id: 'report',
    nav: 'Rapport',
    title: `Rapport #${intervention.id}`,

    render() {
        const client = getClient(intervention.clientId);
        const tech = selectRecommendedTechnician();

        return html`
            ${PageHeader({ title: `Rapport #${intervention.id}`, subtitle: 'Généré à partir de la note vocale du technicien.' })}
            <div class="two">
                <div class="doc">
                    <h2>Rapport d'intervention</h2>
                    <div class="muted">${client.name} · ${report.date} · ${tech.name}</div>
                    <hr>
                    ${report.sections.map((s) => html`<b>${s.title}</b><p>${s.text}</p>`)}
                </div>
                ${Card({
                    variant: 'detail',
                    children: html`
                        ${Pill({ label: 'Rapport prêt', tone: 'green' })}
                        <h2>Suite détectée</h2>
                        ${Notice({
                            tone: 'warning',
                            title: '⚠ Prestation potentiellement facturable',
                            children: report.billingAlert,
                        })}
                        ${Button({ label: 'Générer le brouillon de devis', variant: 'ai', action: 'generateQuote' })}
                        ${Button({ label: 'Envoyer au client', variant: 'light', action: 'sendReport' })}`,
                })}
            </div>`;
    },
};
