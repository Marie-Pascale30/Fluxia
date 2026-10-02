// Actions déclenchées par les éléments [data-action="nom"] (voir main.js).
// Signature : (ctx, data, event) avec ctx = { store, toast, navigate, navigateLater }
// et data = dataset de l'élément cliqué.
import { intervention } from '../data/interventions.js';
import { selectRecommendedTechnician } from './selectors.js';

const setWorkflow = (store, patch) =>
    store.set((s) => ({ workflow: { ...s.workflow, ...patch } }));

export const actions = {
    toast({ toast }, { message }) {
        toast(message);
    },

    openModal({ store }, { modal, ...params }) {
        store.set({ modal: { name: modal, params } });
    },

    closeModal({ store }) {
        store.set({ modal: null });
    },

    createIntervention({ store, toast, navigateLater }) {
        setWorkflow(store, { created: true });
        toast(`Intervention #${intervention.id} créée`);
        navigateLater('intervention');
    },

    assignTechnician({ store, toast, navigateLater }) {
        if (!store.get().workflow.created) return toast("Créez d'abord l'intervention");
        setWorkflow(store, { assigned: true });
        toast('Affectation enregistrée');
        navigateLater('techniciens');
    },

    sendMission({ store, toast, navigateLater }) {
        if (!store.get().workflow.assigned) return toast("Affectez d'abord un technicien");
        setWorkflow(store, { sent: true });
        toast(`Mission envoyée à ${selectRecommendedTechnician().firstName}`);
        navigateLater('mobile');
    },

    generateReport({ store, toast, navigateLater }) {
        const note = document.getElementById('voice-note');
        store.set((s) => ({
            voiceNote: note ? note.value : s.voiceNote,
            workflow: { ...s.workflow, report: true },
        }));
        toast('Rapport généré à partir de la note vocale');
        navigateLater('report');
    },

    generateQuote({ store, toast, navigateLater }) {
        setWorkflow(store, { quote: true });
        toast('Brouillon de devis prêt');
        navigateLater('devis');
    },

    sendReport({ toast, navigateLater }) {
        toast('Rapport envoyé au client');
        navigateLater('devis');
    },
};
