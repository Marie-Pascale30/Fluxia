// Informations légales de la plateforme.
// Fluxia est un projet de démonstration (portfolio), non commercialisé et édité par une personne physique :
// les valeurs par défaut ci-dessous le disent honnêtement. Une mise en service commerciale exigera de les
// remplacer (variables LEGAL_*) et de faire relire les pages légales par un juriste.

export const operator = {
    name: process.env.LEGAL_OPERATOR_NAME || 'Marie Pascale Bogne Sonkeng',
    status:
        process.env.LEGAL_OPERATOR_STATUS ||
        'particulier, éditrice à titre personnel d’un projet de démonstration non commercialisé',
    registration: process.env.LEGAL_OPERATOR_REGISTRATION || 'projet personnel non immatriculé (pas de SIREN ni de RCS)',
    contact: process.env.LEGAL_CONTACT_EMAIL || 'bognesonkeng.mp@gmail.com',
    publicationDirector: process.env.LEGAL_PUBLICATION_DIRECTOR || 'Marie Pascale Bogne Sonkeng',
    updatedAt: process.env.LEGAL_UPDATED_AT || '24 novembre 2026',
};

/** Hébergeurs du service (mentions légales, art. 6 III LCEN). */
export const hosts = [
    {
        role: 'Application web (interface)',
        name: 'Vercel Inc.',
        address: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
        site: 'vercel.com',
    },
    {
        role: 'API (serveur applicatif)',
        name: 'Render Services, Inc.',
        address: 'États-Unis (instance en région Ohio)',
        site: 'render.com',
    },
    {
        role: 'Base de données PostgreSQL',
        name: 'Neon (Postgres managé)',
        address: 'infrastructure AWS, région us-east-2 (Ohio, États-Unis)',
        site: 'neon.com',
    },
];

/** Démonstration : aucun paiement réel n'est possible (Stripe non configuré ou en mode test). */
export const DEMO_NOTICE =
    'Fluxia est un projet de démonstration non commercialisé : aucun abonnement réel n’est vendu, aucun paiement réel n’est encaissé, et les emails et SMS sont simulés.';
