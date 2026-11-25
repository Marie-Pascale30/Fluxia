import {
    BadRequestException,
    Body,
    Controller,
    ForbiddenException,
    Get,
    Global,
    Headers,
    HttpCode,
    Module,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { asOrganization } from '../common/tenant.js';
import { OrganizationService } from '../organizations/organizations.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestsModule } from '../requests/requests.module.js';
import { RequestsService } from '../requests/requests.service.js';
import { ImapPoller } from './imap.poller.js';
import { normalizeInbound } from './inbound.js';
import { OutboxService } from './outbox.service.js';

/**
 * Webhook de réception d'emails (Postmark, Mailgun, SendGrid, format générique).
 * Chaque entreprise a son jeton secret (paramètres de l'entreprise), qui désigne l'entreprise destinataire.
 * Transmission recommandée : en-tête `x-fluxia-token`. Le paramètre `?token=` reste accepté pour compatibilité
 * (fournisseurs qui ne permettent pas d'en-tête personnalisé), mais l'en-tête est prioritaire.
 */
@Public()
@Controller('inbound')
class InboundController {
    constructor(
        private readonly requests: RequestsService,
        private readonly organizations: OrganizationService,
    ) {}

    @Post('email')
    @HttpCode(200)
    async email(
        @Body() payload: Record<string, unknown>,
        @Headers('x-fluxia-token') header?: string,
        @Query('token') query?: string,
    ) {
        const organization = await this.organizations.byInboundToken(header || query || '');
        if (!organization) throw new ForbiddenException('Jeton invalide');

        const email = normalizeInbound(payload);
        if (!email) throw new BadRequestException('Email entrant illisible (expéditeur ou texte manquant)');

        const request = await asOrganization(organization.id, () =>
            this.requests.ingest(
                {
                    fromName: email.fromName.slice(0, 120),
                    fromEmail: email.fromEmail,
                    subject: email.subject.slice(0, 200),
                    body: email.text.slice(0, 10_000),
                    attachments: Math.min(50, email.attachments),
                },
                email.externalId,
            ),
        );
        return { id: request.id, status: request.status };
    }
}

@Controller('messages')
class MessagesController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly outbox: OutboxService,
    ) {}

    @Get()
    async list(@Query('status') status?: 'PENDING' | 'SENT' | 'FAILED') {
        // Emails de sécurité adressés à un utilisateur (réinitialisation du mot de passe) : jamais visibles des autres responsables
        const [messages, counts] = await Promise.all([
            this.prisma.outboundMessage.findMany({
                where: { sensitive: false, ...(status ? { status } : {}) },
                orderBy: { createdAt: 'desc' },
                take: 100,
                omit: { sensitive: true, template: true },
            }),
            this.prisma.outboundMessage.groupBy({ by: ['status'], where: { sensitive: false }, _count: true }),
        ]);
        return {
            transports: this.outbox.transports,
            counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
            messages,
        };
    }

    @Post(':id/retry')
    @HttpCode(200)
    async retry(@Param('id') id: string) {
        await this.outbox.retry(id);
        return this.prisma.outboundMessage.findUniqueOrThrow({ where: { id, sensitive: false }, omit: { sensitive: true, template: true } });
    }
}

@Global()
@Module({
    imports: [RequestsModule],
    controllers: [InboundController, MessagesController],
    providers: [OutboxService, ImapPoller],
    exports: [OutboxService],
})
export class MessagingModule {}
