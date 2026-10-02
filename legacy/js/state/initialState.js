import { intervention } from '../data/interventions.js';

export const initialState = {
    page: 'home',
    modal: null, // { name, params } | null

    // Étapes du parcours de démo
    workflow: {
        created: false,
        assigned: false,
        sent: false,
        report: false,
        quote: false,
    },

    voiceNote: intervention.defaultVoiceNote,
};
