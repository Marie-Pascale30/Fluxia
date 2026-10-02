import {
    Body,
    Controller,
    Get,
    HttpCode,
    Injectable,
    Logger,
    Module,
    Post,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthGuard, RequestContextInterceptor } from './auth.guard.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { CurrentUser, Public, Roles } from './decorators.js';
import { hashPassword, verifyPassword } from './password.js';

class LoginDto {
    @IsEmail() email: string;
    @IsString() @MinLength(1) password: string;
}

const SESSION_HOURS = 12;

function jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.length >= 32) return secret;
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET (32 caractères minimum) est obligatoire en production');
    new Logger('Auth').warn('JWT_SECRET absent ou trop court : clé de développement utilisée');
    return 'fluxia-dev-secret-ne-pas-utiliser-en-production';
}

@Injectable()
export class AuthService {
    // Empreinte factice : même temps de réponse que l'email existe ou non
    private readonly dummyHash = hashPassword('dummy-password');

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
    ) {}

    async login(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        const valid = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
        if (!user || !valid || !user.active) throw new UnauthorizedException('Email ou mot de passe incorrect');

        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        const payload: JwtPayload = { sub: user.id, role: user.role, tid: user.technicianId, name: user.name };
        return {
            token: await this.jwt.signAsync(payload),
            expiresIn: SESSION_HOURS * 3600,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, technicianId: user.technicianId },
        };
    }
}

@Controller('auth')
class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Public()
    @Post('login')
    @HttpCode(200)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT ?? 10), ttl: 60_000 } })
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto.email, dto.password);
    }

    @Get('me')
    @Roles('MANAGER', 'TECHNICIAN')
    me(@CurrentUser() user: AuthUser) {
        return user;
    }
}

@Module({
    imports: [
        JwtModule.registerAsync({
            global: true,
            useFactory: () => ({ secret: jwtSecret(), signOptions: { expiresIn: `${SESSION_HOURS}h` } }),
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    ],
    exports: [AuthService],
})
export class AuthModule {}
