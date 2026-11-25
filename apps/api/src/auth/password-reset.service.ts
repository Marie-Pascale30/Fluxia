import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ActivityService } from '../activity/activity.service.js';
import { asOrganization, asSystem } from '../common/tenant.js';
import type { OutboundMessage } from '../generated/prisma/client.js';
import { OutboxService } from '../messaging/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';

export class ForgotPasswordDto {
    @IsEmail() email: string;
}

export class ResetPasswordDto {
    @IsString() @MinLength(20) @MaxLength(200) token: string;
    @IsString() @MinLength(8) @MaxLength(200) password: string;
}

export class ChangePasswordDto {
    @IsString() @MinLength(1) currentPassword: string;
    @IsString() @MinLength(8) @MaxLength(200) newPassword: string;
}

const TOKEN_MINUTES = 60;
const WEB_URL = () => (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
/** Seule l'empreinte du jeton est stockée : une fuite de la base ne permet pas de réinitialiser un compte. */
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export const PASSWORD_RESET_TEMPLATE = 'PASSWORD_RESET';
/** Seule trace conservée de l'email : le lien n'est jamais enregistré en base, ni visible des autres responsables. */
export const PASSWORD_RESET_STORED_BODY = 'Lien de réinitialisation envoyé (contenu non conservé).';

/**
 * Mot de passe oublié et changement de mot de passe.
 * Un changement invalide toutes les sessions ouvertes (sessionVersion, vérifiée par la garde).
 *
 * Le lien de réinitialisation n'est jamais stocké : la boîte d'envoi ne garde qu'une mention neutre,
 * et le jeton est tiré au moment de l'expédition (seule son empreinte est enregistrée sur l'utilisateur).
 */
@Injectable()
export class PasswordResetService implements OnModuleInit {
    private readonly logger = new Logger(PasswordResetService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly outbox: OutboxService,
    ) {}

    onModuleInit() {
        this.outbox.registerTemplate(PASSWORD_RESET_TEMPLATE, (message) => this.renderResetEmail(message));
    }

    /** Met en file un email de réinitialisation. Réponse identique que le compte existe ou non. */
    async request(email: string) {
        const user = await asSystem(() => this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } }));
        if (!user?.active) return;

        await asOrganization(user.organizationId, () =>
            this.activity.sendMessage({
                recipient: user.email,
                subject: 'Réinitialisation de votre mot de passe Fluxia',
                body: PASSWORD_RESET_STORED_BODY,
                entityType: 'USER',
                entityId: user.id,
                sensitive: { template: PASSWORD_RESET_TEMPLATE },
            }),
        );
        this.logger.log(`Lien de réinitialisation demandé (utilisateur ${user.id})`);
    }

    /**
     * Au moment de l'envoi : nouveau jeton (empreinte enregistrée, valable TOKEN_MINUTES) et texte de l'email.
     * Une nouvelle tentative d'envoi produit un nouveau jeton, qui remplace le précédent.
     */
    private async renderResetEmail(message: OutboundMessage): Promise<string> {
        const user = await this.prisma.user.findUnique({ where: { id: message.entityId } });
        if (!user?.active) throw new Error('Compte introuvable ou désactivé');
        const token = randomBytes(32).toString('base64url');
        await this.prisma.user.update({
            where: { id: user.id },
            data: { resetTokenHash: digest(token), resetTokenExpiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000) },
        });
        return [
            `Bonjour ${user.name},`,
            `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable ${TOKEN_MINUTES} minutes, une seule fois) :`,
            `${WEB_URL()}/mot-de-passe/${token}`,
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
        ].join('\n\n');
    }

    /** Nouveau mot de passe à partir du lien reçu ; renvoie l'utilisateur pour ouvrir sa session. */
    async reset(token: string, password: string) {
        const user = await asSystem(() => this.prisma.user.findUnique({ where: { resetTokenHash: digest(token) } }));
        if (!user?.active || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
            throw new BadRequestException('Lien invalide ou expiré : refaites une demande de réinitialisation');
        }
        return asOrganization(user.organizationId, async () => {
            const updated = await this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: await hashPassword(password), resetTokenHash: null, resetTokenExpiresAt: null, sessionVersion: { increment: 1 } },
                include: { organization: { select: { name: true } } },
            });
            await this.activity.log({ actor: 'SYSTEM', type: 'PASSWORD_RESET', message: `Mot de passe de ${user.name} réinitialisé par email`, entityType: 'USER', entityId: user.id });
            return updated;
        });
    }

    /** Changement par l'utilisateur connecté (mot de passe actuel exigé). */
    async change(userId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { organization: { select: { name: true } } } });
        if (!(await verifyPassword(dto.currentPassword, user.passwordHash))) throw new BadRequestException('Mot de passe actuel incorrect');
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: await hashPassword(dto.newPassword), resetTokenHash: null, resetTokenExpiresAt: null, sessionVersion: { increment: 1 } },
            include: { organization: { select: { name: true } } },
        });
        await this.activity.log({ actor: 'USER', type: 'PASSWORD_CHANGED', message: `${user.name} a changé son mot de passe`, entityType: 'USER', entityId: userId });
        return updated;
    }
}
