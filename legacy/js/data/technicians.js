export const technicians = [
    {
        id: 'thomas',
        firstName: 'Thomas',
        name: 'Thomas Martin',
        initials: 'TM',
        skill: 'Climatisation',
        interventionsToday: 4,
        availability: { label: '14h30', tone: 'green' },
    },
    {
        id: 'marc',
        firstName: 'Marc',
        name: 'Marc Lefèvre',
        initials: 'ML',
        skill: 'Chauffage',
        interventionsToday: 5,
        availability: { label: 'Complet', tone: 'red' },
    },
    {
        id: 'sophie',
        firstName: 'Sophie',
        name: 'Sophie Dubois',
        initials: 'SD',
        skill: 'CVC',
        interventionsToday: 3,
        availability: { label: '16h', tone: 'blue' },
    },
];

export const getTechnician = (id) => technicians.find((t) => t.id === id);
