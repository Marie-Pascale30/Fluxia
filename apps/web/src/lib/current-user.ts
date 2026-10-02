import { cache } from 'react';
import { api } from './api';

/** Utilisateur connecté, récupéré une seule fois par requête (layout + pages). */
export const getCurrentUser = cache(() => api.auth.me());
