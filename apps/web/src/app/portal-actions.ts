'use server';

// Actions publiques du portail client : aucune session, l'API vérifie le lien signé.
import { api, ApiError } from '@/lib/api';

export async function portalDecision(token: string, quoteId: string, accept: boolean, name: string, note: string) {
    try {
        // Pas de revalidation : la confirmation reste affichée là où le client a répondu
        await api.portal.decide(token, quoteId, { accept, name, note: note || undefined });
        return {
            ok: true,
            message: accept
                ? 'Merci ! Votre accord a bien été enregistré, nous revenons vers vous pour planifier les travaux.'
                : 'Votre réponse a bien été enregistrée.',
        };
    } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : 'Une erreur est survenue, réessayez.' };
    }
}
