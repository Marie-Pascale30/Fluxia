export const clients = {
    parisien: {
        id: 'parisien',
        name: 'Restaurant Le Parisien',
        shortName: 'Restaurant Parisien',
        address: '18 rue de Rivoli, Paris 4e',
        contract: 'Maintenance CVC · actif',
        equipmentCount: 3,
        interventionsLabel: '3 sur 12 mois',
        historyLabel: '3 interventions',
        lastIntervention: '30/09/2026 · #4581',
        summary: "Contrat actif · 3 interventions · dernier passage aujourd'hui",
        hasDetail: true,
    },
    rivoli: {
        id: 'rivoli',
        name: 'SCI Rivoli',
        summary: 'Contrat actif · 8 équipements',
        hasDetail: false,
    },
};

export const getClient = (id) => clients[id];
