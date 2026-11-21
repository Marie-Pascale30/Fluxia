// Informations de l'exploitant de la plateforme (variables d'environnement du web).
// Modèles de pages légales : à faire relire par un juriste avant toute mise en service.
const TODO = '[à compléter]';

export const operator = {
    name: process.env.LEGAL_OPERATOR_NAME || TODO,
    address: process.env.LEGAL_OPERATOR_ADDRESS || TODO,
    registration: process.env.LEGAL_OPERATOR_REGISTRATION || TODO,
    contact: process.env.LEGAL_CONTACT_EMAIL || TODO,
    host: process.env.LEGAL_HOST || TODO,
    publicationDirector: process.env.LEGAL_PUBLICATION_DIRECTOR || TODO,
    updatedAt: process.env.LEGAL_UPDATED_AT || TODO,
};
