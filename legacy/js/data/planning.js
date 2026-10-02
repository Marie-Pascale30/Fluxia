export const planning = {
    technicianIds: ['thomas', 'marc', 'sophie'],
    timeRows: ['09:00', '14:00'],
    slots: [
        { technicianId: 'thomas', row: '09:00', time: '09:00', type: 'Entretien', client: 'Client ABC', confirmed: true },
        { technicianId: 'marc', row: '09:00', time: '09:00', type: 'Chaudière', client: 'SCI Atlas' },
        { technicianId: 'sophie', row: '09:00', time: '09:00', type: 'VMC', client: 'École Victor' },
        { technicianId: 'thomas', row: '14:00', time: '14:30', type: 'Panne', client: 'Restaurant Parisien', interventionId: 4581 },
        { technicianId: 'marc', row: '14:00', time: '14:00', type: 'SAV', client: 'Résidence Opéra' },
        { technicianId: 'sophie', row: '14:00', time: '14:00', type: 'Entretien', client: 'SCI Rivoli' },
    ],
};
