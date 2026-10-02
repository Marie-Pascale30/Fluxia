// Session : le jeton JWT de l'API est conservé dans un cookie httpOnly,
// jamais exposé au JavaScript du navigateur.

export const SESSION_COOKIE = 'fluxia_session';

export type Role = 'MANAGER' | 'TECHNICIAN';

export interface SessionUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    technicianId: string | null;
}

interface TokenClaims {
    sub: string;
    role: Role;
    tid: string | null;
    name: string;
    exp: number;
}

/**
 * Lecture NON vérifiée du contenu du jeton : sert uniquement aux redirections
 * optimistes (proxy). L'API vérifie la signature à chaque appel.
 */
export function readClaims(token: string | undefined): TokenClaims | null {
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const claims = JSON.parse(json) as TokenClaims;
        return claims.exp * 1000 > Date.now() ? claims : null;
    } catch {
        return null;
    }
}

/** Page d'accueil selon le rôle. */
export const homeFor = (claims: { role: Role; tid?: string | null; technicianId?: string | null }) => {
    const tid = claims.tid ?? claims.technicianId;
    return claims.role === 'TECHNICIAN' && tid ? `/techniciens/${tid}` : '/';
};
