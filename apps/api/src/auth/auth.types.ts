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
}

export interface JwtPayload {
    sub: string;
    role: Role;
    tid: string | null;
    name: string;
}

/** Contexte de la requête en cours (utilisateur), accessible partout sans le passer en paramètre. */
export const requestContext = new AsyncLocalStorage<{ user: AuthUser | null }>();

export const currentUser = () => requestContext.getStore()?.user ?? null;

/** Un technicien ne peut agir que sur ses propres interventions. */
export function assertInterventionAccess(user: AuthUser | null, technicianId: string | null) {
    if (user?.role === 'TECHNICIAN' && user.technicianId !== technicianId) {
        throw new ForbiddenException('Cette intervention ne vous est pas affectée');
    }
}
