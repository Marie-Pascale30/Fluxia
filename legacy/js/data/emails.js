export const emails = [
    {
        id: 'clim-parisien',
        tag: { label: 'Urgent', tone: 'red' },
        subject: 'Panne climatisation — Restaurant Le Parisien',
        fullSubject: 'Urgent — climatisation en panne',
        preview: '« La clim ne refroidit plus depuis ce matin et fait un bruit bizarre. Pouvez-vous intervenir rapidement ? »',
        receivedAt: '08:42',
        channel: 'Email',
        body: [
            'Bonjour,',
            "La climatisation du restaurant ne refroidit plus depuis ce matin. Elle fait également un bruit assez inhabituel au niveau du groupe extérieur. Nous avons du monde ce midi et aurions besoin d'une intervention rapidement.",
            'Merci,\nMarc — Restaurant Le Parisien',
        ],
    },
    {
        id: 'vmc-rivoli',
        tag: { label: 'Devis', tone: 'blue' },
        subject: 'Remplacement moteur VMC — SCI Rivoli',
        preview: 'Demande de chiffrage avec 3 photos.',
        receivedAt: '08:17',
        channel: 'Email',
    },
    {
        id: 'entretien-morel',
        tag: { label: 'Contrat', tone: 'green' },
        subject: 'Entretien annuel — Cabinet Morel',
        preview: 'Échéance détectée dans le contrat.',
        receivedAt: 'Hier',
        channel: 'Email',
    },
];

export const getEmail = (id) => emails.find((e) => e.id === id);
