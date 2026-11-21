import {
    ForbiddenException,
    HttpException,
    HttpStatus,
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
import { canWrite } from '../billing/subscription.js';
import { asSystem } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requestContext, type AuthUser, type JwtPayload, type Role } from './auth.types.js';
import { IS_PUBLIC, ROLES, SUBSCRIPTION_EXEMPT } from './decorators.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

        // Vérifié à chaque requête : un compte désactivé perd l'accès immédiatement.
        // Lecture transverse : l'entreprise n'est connue qu'une fois l'utilisateur identifié.
        const user = await asSystem(() =>
            this.prisma.user.findUnique({ where: { id: payload.sub }, include: { organization: { select: { name: true, subscriptionStatus: true, trialEndsAt: true } } } }),
        );
        if (!user?.active) throw new UnauthorizedException('Compte désactivé');
        if (payload.sv !== user.sessionVersion) throw new UnauthorizedException('Mot de passe modifié, reconnectez-vous');

        const authUser: AuthUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            technicianId: user.technicianId,
            organizationId: user.organizationId,
            organizationName: user.organization.name,
        };
        request.user = authUser;

        const allowed = this.reflector.getAllAndOverride<Role[]>(ROLES, targets) ?? ['MANAGER'];
        if (!allowed.includes(authUser.role)) throw new ForbiddenException('Accès réservé');

        // Sans abonnement utilisable (essai terminé, résiliation) : lecture seule
        if (!READ_METHODS.has(request.method) && !this.reflector.getAllAndOverride<boolean>(SUBSCRIPTION_EXEMPT, targets) && !canWrite(user.organization)) {
            throw new HttpException(
                user.organization.subscriptionStatus === 'TRIALING'
                    ? "Votre période d'essai est terminée : abonnez-vous pour continuer (page Abonnement). Vos données restent consultables."
                    : 'Votre abonnement est inactif : réactivez-le pour continuer (page Abonnement). Vos données restent consultables.',
                HttpStatus.PAYMENT_REQUIRED,
            );
        }
        return true;
    }
}

/**
 * Rend l'utilisateur courant et son entreprise disponibles via requestContext pendant tout le traitement :
 * toutes les requêtes Prisma de la requête HTTP sont restreintes à cette entreprise.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const user: AuthUser | null = context.switchToHttp().getRequest().user ?? null;
        return new Observable((subscriber) =>
            requestContext.run({ user, organizationId: user?.organizationId ?? null }, () =>
                next.handle().subscribe(subscriber),
            ),
        );
    }
}
