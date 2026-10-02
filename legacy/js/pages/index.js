// Registre des pages : l'ordre ici = l'ordre dans la sidebar.
// Pour ajouter une page : créer le fichier puis l'ajouter à cette liste.
import home from './home.js';
import inbox from './inbox.js';
import intervention from './intervention.js';
import planning from './planning.js';
import techniciens from './techniciens.js';
import mobile from './mobile.js';
import report from './report.js';
import devis from './devis.js';
import clients from './clients.js';

export const pages = [home, inbox, intervention, planning, techniciens, mobile, report, devis, clients];

export const getPage = (id) => pages.find((p) => p.id === id) ?? pages[0];
