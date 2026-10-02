export const quotes = [
    {
        id: 'parisien-condensateur',
        title: 'Restaurant Le Parisien — Condensateur',
        subtitle: 'Depuis intervention #4581',
        status: { label: 'À valider', tone: 'orange' },
    },
    {
        id: 'rivoli-vmc',
        title: 'SCI Rivoli — moteur VMC',
        subtitle: 'Rapport + photos disponibles',
        generateMessage: 'Brouillon SCI Rivoli généré',
    },
];

// Brouillon généré à partir du rapport #4581
export const draftQuote = {
    number: 'D-2026-091',
    clientId: 'parisien',
    service: 'Remplacement condensateur climatisation',
    labor: '1,0 h',
    totalHT: '286,00 €',
    warning: 'prix de la pièce et couverture contractuelle.',
};
