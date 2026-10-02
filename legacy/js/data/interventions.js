// Intervention au cœur du parcours de démo.
export const intervention = {
    id: 4581,
    clientId: 'parisien',
    emailId: 'clim-parisien',
    title: 'Panne climatisation',
    priority: { label: 'Urgente', tone: 'red' },
    equipment: 'Climatisation — unité extérieure',
    problem: 'Ne refroidit plus + bruit inhabituel',
    aiUnderstanding: 'Absence de froid + bruit inhabituel. Priorité haute. Contrat de maintenance actif.',
    proposedAction: "Créer une intervention et proposer un technicien disponible aujourd'hui.",
    initialDiagnosis: 'Vérifier condensateur, pression, alimentation et unité extérieure.',
    recommendedTechnicianId: 'thomas',
    slot: { time: '14:30', label: "14h30 aujourd'hui", short: '14h30' },
    recommendationReasons: [
        { title: 'Compétence', detail: 'Climatisation / froid' },
        { title: 'Disponibilité', detail: "14h30 aujourd'hui" },
        { title: 'Trajet', detail: '14 km' },
        { title: 'Historique', detail: 'Déjà intervenu sur cet équipement' },
    ],
    defaultVoiceNote:
        "J'ai trouvé le condensateur défectueux. Je l'ai remplacé, vérifié la pression et redémarré le groupe. Tout fonctionne normalement. Je recommande un nettoyage complet au prochain passage.",
};

export const report = {
    date: '30/09/2026',
    sections: [
        { title: 'Motif', text: 'Panne de climatisation avec bruit inhabituel.' },
        { title: 'Diagnostic', text: 'Condensateur défectueux.' },
        { title: 'Travaux réalisés', text: 'Remplacement du condensateur, contrôle de pression et redémarrage du groupe.' },
        { title: 'Résultat', text: 'Équipement opérationnel.' },
        { title: 'Recommandation', text: 'Prévoir un nettoyage complet au prochain passage.' },
    ],
    billingAlert:
        'Le remplacement du condensateur semble hors forfait standard. Fluxia propose un brouillon de devis.',
};
