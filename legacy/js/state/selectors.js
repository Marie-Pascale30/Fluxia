// Données dérivées de l'état : aucune valeur calculée n'est stockée en double.
import { baseCounters } from '../data/dashboard.js';
import { intervention } from '../data/interventions.js';
import { getTechnician } from '../data/technicians.js';

export function selectCounters({ workflow: w }) {
    const b = baseCounters;
    return {
        inboxTotal: b.inboxTotal - (w.created ? 1 : 0),
        inboxPending: b.inboxPending - (w.created ? 1 : 0),
        interventionsToday: b.interventionsToday + (w.created ? 1 : 0),
        reportsPending: b.reportsPending - (w.report ? 1 : 0),
        quotesPending: b.quotesPending + (w.quote ? 1 : 0),
    };
}

export const selectRecommendedTechnician = () => getTechnician(intervention.recommendedTechnicianId);

export function selectInterventionSteps({ workflow: w }) {
    return [
        { label: '1 · Demande comprise', done: true },
        { label: '2 · Intervention créée', done: w.created },
        { label: '3 · Technicien affecté', done: w.assigned },
        { label: '4 · Mission envoyée', done: w.sent },
    ];
}
