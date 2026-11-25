import {
    Body,
    Controller,
    Get,
    HttpCode,
    Injectable,
    Module,
    Post,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { loginLimiter, passwordResetLimiter, signupLimiter } from '../common/rate-limit.js';
import { appSecret } from '../common/secrets.js';
import { asSystem } from '../common/tenant.js';
import { OrganizationService, SignupDto } from '../organizations/organizations.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthGuard, RequestContextInterceptor } from './auth.guard.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { CurrentUser, Public, Roles, SubscriptionExempt } from './decorators.js';
import { hashPassword, verifyPassword } from './password.js';
import { ChangePasswordDto, ForgotPasswordDto, PasswordResetService, ResetPasswordDto } from './password-reset.service.js';

class LoginDto {
    @IsEmail() email: string;
    @IsString() @MinLength(1) password: string;
}

const SESSION_HOURS = 12;

/**
 * Limitation des tentatives.
 * Les appels arrivent du serveur web (Server Actions) : l'IP vue ici est celle de l'hébergeur du web, partagée par
 * tous les internautes. Plutôt que de faire confiance à un en-tête X-Forwarded-For (falsifiable sans secret partagé),
 * on combine : une limite par email (échecs de connexion, demandes de réinitialisation, inscriptions) et un plafond
 * global élevé par IP (ThrottlerGuard), qui protège l'API sans bloquer les utilisateurs légitimes entre eux.
 */
const AUTH_CEILING = Number(process.env.AUTH_RATE_CEILING ?? 300);

@Injectable()
export class AuthService {
    // Empreinte factice : même temps de réponse que l'email existe ou non
    private readonly dummyHash = hashPassword('dummy-password');
    private readonly loginFailures = loginLimiter();
    private readonly signups = signupLimiter();

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly organizations: OrganizationService,
    ) {}

    async login(email: string, password: string) {
        // Trop d'échecs récents pour cet email (quel que soit l'appelant) : refus avant toute vérification
        this.loginFailures.check(email);
        // Lecture transverse : l'entreprise de l'utilisateur n'est pas encore connue
        const user = await asSystem(() =>
            this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, include: { organization: { select: { name: true } } } }),
        );
        const valid = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
        if (!user || !valid || !user.active) {
            this.loginFailures.record(email);
            throw new UnauthorizedException('Email ou mot de passe incorrect');
        }
        this.loginFailures.reset(email);

        await asSystem(() => this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }));
        return this.session({ ...user, organizationName: user.organization.name });
    }

    /** Crée l'entreprise et son responsable, puis ouvre directement sa session. */
    async signup(dto: SignupDto) {
        // Limite par email : freine l'énumération des comptes existants via le message « adresse indisponible »
        this.signups.consume(dto.email);
        const user = await this.organizations.signup(dto);
        return this.session({ ...user, organizationName: dto.organizationName.trim() });
    }

    /** Nouvelle session (après connexion, inscription ou changement de mot de passe). */
    async session(user: Omit<AuthUser, 'organizationName'> & { organizationName: string; sessionVersion: number }) {
        const payload: JwtPayload = {
            sub: user.id,
            role: user.role,
            tid: user.technicianId,
            name: user.name,
            org: user.organizationId,
            sv: user.sessionVersion,
        };
        const authUser: AuthUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            technicianId: user.technicianId,
            organizationId: user.organizationId,
            organizationName: user.organizationName,
        };
        return { token: await this.jwt.signAsync(payload), expiresIn: SESSION_HOURS * 3600, user: authUser };
    }

    /** Déconnexion : le jeton présenté (et toute autre session de l'utilisateur) cesse immédiatement d'être valable. */
    async logout(userId: string) {
        await asSystem(() => this.prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }));
    }
}

@SubscriptionExempt()
@Controller('auth')
class AuthController {
    private readonly resetRequests = passwordResetLimiter();

    constructor(
        private readonly auth: AuthService,
        private readonly passwords: PasswordResetService,
    ) {}

    @Public()
    @Post('login')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT ?? AUTH_CEILING), ttl: 60_000 } })
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto.email, dto.password);
    }

    @Public()
    @Post('signup')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.SIGNUP_RATE_LIMIT ?? 30), ttl: 60_000 } })
    signup(@Body() dto: SignupDto) {
        return this.auth.signup(dto);
    }

    @Get('me')
    @Roles('MANAGER', 'TECHNICIAN')
    me(@CurrentUser() user: AuthUser) {
        return user;
    }

    /** Déconnexion : révoque le jeton (incrémente la version de session de l'utilisateur). */
    @Post('logout')
    @HttpCode(204)
    @Roles('MANAGER', 'TECHNICIAN')
    async logout(@CurrentUser() user: AuthUser) {
        await this.auth.logout(user.id);
    }

    /** Mot de passe oublié : toujours la même réponse (ne révèle pas si le compte existe). */
    @Public()
    @Post('forgot-password')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT ?? AUTH_CEILING), ttl: 60_000 } })
    async forgot(@Body() dto: ForgotPasswordDto) {
        this.resetRequests.consume(dto.email);
        await this.passwords.request(dto.email);
        return { message: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé.' };
    }

    /** Nouveau mot de passe depuis le lien reçu par email ; ouvre directement la session. */
    @Public()
    @Post('reset-password')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT ?? AUTH_CEILING), ttl: 60_000 } })
    async reset(@Body() dto: ResetPasswordDto) {
        const user = await this.passwords.reset(dto.token, dto.password);
        return this.auth.session({ ...user, organizationName: user.organization.name });
    }

    /** Changement de mot de passe : les autres sessions sont fermées, une nouvelle est renvoyée. */
    @Post('password')
    @HttpCode(200)
    @Roles('MANAGER', 'TECHNICIAN')
    async change(@CurrentUser() current: AuthUser, @Body() dto: ChangePasswordDto) {
        const user = await this.passwords.change(current.id, dto);
        return this.auth.session({ ...user, organizationName: user.organization.name });
    }
}

@Module({
    imports: [
        JwtModule.registerAsync({
            global: true,
            useFactory: () => ({ secret: appSecret(), signOptions: { expiresIn: `${SESSION_HOURS}h` } }),
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        PasswordResetService,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    ],
    exports: [AuthService],
})
export class AuthModule {}
