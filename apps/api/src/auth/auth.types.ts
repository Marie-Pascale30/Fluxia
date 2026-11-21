import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';

export type Role = 'MANAGER' | 'TECHNICIAN';

/** Utilisateur authentifié attaché à la requête. */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    technicianId: string | null;
    organizationId: string;
    organizationName: string;
}

export interface JwtPayload {
    sub: string;
    role: Role;
    tid: string | null;
    name: string;
    org: string;
    /** Version de session : un changement de mot de passe invalide les jetons antérieurs */
    sv: number;
}

/**
 * Contexte de la requête en cours, accessible partout sans le passer en paramètre :
 * utilisateur connecté et entreprise dont les données sont accessibles (cf. common/tenant.ts).
 */
export interface RequestStore {
    user: AuthUser | null;
    organizationId: string | null;
    /** Accès transverse à toutes les entreprises (asSystem) */
    system?: boolean;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export const currentUser = () => requestContext.getStore()?.user ?? null;

/** Un technicien ne peut agir que sur ses propres interventions. */
export function assertInterventionAccess(user: AuthUser | null, technicianId: string | null) {
    if (user?.role === 'TECHNICIAN' && user.technicianId !== technicianId) {
        throw new ForbiddenException('Cette intervention ne vous est pas affectée');
    }
}
