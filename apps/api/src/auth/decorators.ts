import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { AuthUser, Role } from './auth.types.js';

export const IS_PUBLIC = 'auth:public';
export const ROLES = 'auth:roles';

/** Route accessible sans authentification (connexion, portail client, webhooks signés…). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Rôles autorisés. Sans ce décorateur, seule la direction (MANAGER) a accès. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
    (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
