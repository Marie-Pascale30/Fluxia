import { html } from '../core/html.js';
import { Button, Card, KpiCard, PageHeader, Pill, Row } from '../components/index.js';
import { currentUser } from '../data/dashboard.js';
import { selectCounters } from '../state/selectors.js';

export default {
    id: 'home',
    nav: "Vue d'ensemble",

    render(state) {
        const c = selectCounters(state);

        const activity = [
            { title: 'Demandes qualifiées', source: 'Inbox IA', status: { label: 'Terminé', tone: 'green' } },
            { title: 'Affectations proposées', source: 'Planning', status: { label: 'À valider', tone: 'blue' } },
            { title: 'Rapports générables', source: 'Notes techniciens', status: { label: c.reportsPending, tone: 'blue' } },
        ];

        return html`
            ${PageHeader({
                title: `Bonjour ${currentUser.firstName} 👋`,
                subtitle: 'Un bureau administratif IA pour les entreprises de maintenance.',
            })}
            <div class="grid g4">
                ${KpiCard({ label: 'Demandes entrantes', value: c.inboxTotal, hint: `${c.inboxPending} à traiter` })}
                ${KpiCard({ label: 'Interventions', value: c.interventionsToday, hint: "aujourd'hui" })}
                ${KpiCard({ label: 'Rapports', value: c.reportsPending, hint: 'à traiter' })}
                ${KpiCard({ label: 'Devis', value: c.quotesPending, hint: 'à préparer' })}
            </div>
            <div class="two mt-18">
                ${Card({
                    title: 'Activité automatisée',
                    children: activity.map((a) => Row({ title: a.title, subtitle: a.source, aside: Pill(a.status) })),
                })}
                <div class="hero">
                    <h2>L'IA propose, vous décidez.</h2>
                    <p>Chaque étape produit un résultat visible et traçable : intervention créée, technicien
                        affecté, client informé, rapport généré, devis préparé.</p>
                    ${Button({ label: "Voir l'expérience →", variant: 'light', href: 'inbox' })}
                </div>
            </div>`;
    },
};
