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

@Injectable()
export class AuthService {
    // Empreinte factice : même temps de réponse que l'email existe ou non
    private readonly dummyHash = hashPassword('dummy-password');

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly organizations: OrganizationService,
    ) {}

    async login(email: string, password: string) {
        // Lecture transverse : l'entreprise de l'utilisateur n'est pas encore connue
        const user = await asSystem(() =>
            this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, include: { organization: { select: { name: true } } } }),
        );
        const valid = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
        if (!user || !valid || !user.active) throw new UnauthorizedException('Email ou mot de passe incorrect');

        await asSystem(() => this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }));
        return this.session({ ...user, organizationName: user.organization.name });
    }

    /** Crée l'entreprise et son responsable, puis ouvre directement sa session. */
    async signup(dto: SignupDto) {
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
}

@SubscriptionExempt()
@Controller('auth')
class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly passwords: PasswordResetService,
    ) {}

    @Public()
    @Post('login')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT ?? 10), ttl: 60_000 } })
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto.email, dto.password);
    }

    @Public()
    @Post('signup')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.SIGNUP_RATE_LIMIT ?? 5), ttl: 60_000 } })
    signup(@Body() dto: SignupDto) {
        return this.auth.signup(dto);
    }

    @Get('me')
    @Roles('MANAGER', 'TECHNICIAN')
    me(@CurrentUser() user: AuthUser) {
        return user;
    }

    /** Mot de passe oublié : toujours la même réponse (ne révèle pas si le compte existe). */
    @Public()
    @Post('forgot-password')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT ?? 10), ttl: 60_000 } })
    async forgot(@Body() dto: ForgotPasswordDto) {
        await this.passwords.request(dto.email);
        return { message: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé.' };
    }

    /** Nouveau mot de passe depuis le lien reçu par email ; ouvre directement la session. */
    @Public()
    @Post('reset-password')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT ?? 10), ttl: 60_000 } })
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
