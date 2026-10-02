import {
    ForbiddenException,
    Injectable,
    UnauthorizedException,
    type CallHandler,
    type CanActivate,
    type ExecutionContext,
    type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { requestContext, type AuthUser, type JwtPayload, type Role } from './auth.types.js';
import { IS_PUBLIC, ROLES } from './decorators.js';

/**
 * Garde globale : toute route exige un jeton valide, sauf @Public().
 * Les rôles autorisés se déclarent avec @Roles() (défaut : MANAGER uniquement).
 */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const targets = [context.getHandler(), context.getClass()];
        if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

        const request = context.switchToHttp().getRequest();
        const header: string | undefined = request.headers.authorization;
        const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
        if (!token) throw new UnauthorizedException('Authentification requise');

        let payload: JwtPayload;
        try {
            payload = await this.jwt.verifyAsync<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException('Session expirée, reconnectez-vous');
        }

        // Vérifié à chaque requête : un compte désactivé perd l'accès immédiatement
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user?.active) throw new UnauthorizedException('Compte désactivé');

        const authUser: AuthUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            technicianId: user.technicianId,
        };
        request.user = authUser;

        const allowed = this.reflector.getAllAndOverride<Role[]>(ROLES, targets) ?? ['MANAGER'];
        if (!allowed.includes(authUser.role)) throw new ForbiddenException('Accès réservé');
        return true;
    }
}

/** Rend l'utilisateur courant disponible via requestContext pendant tout le traitement. */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const user: AuthUser | null = context.switchToHttp().getRequest().user ?? null;
        return new Observable((subscriber) =>
            requestContext.run({ user }, () => next.handle().subscribe(subscriber)),
        );
    }
}
