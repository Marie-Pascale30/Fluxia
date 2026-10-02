import { timingSafeEqual } from 'node:crypto';
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
    NotFoundException,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestsModule } from '../requests/requests.module.js';
import { RequestsService } from '../requests/requests.service.js';
import { ImapPoller } from './imap.poller.js';
import { normalizeInbound } from './inbound.js';
import { OutboxService } from './outbox.service.js';

const sameSecret = (a: string, b: string) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Webhook de réception d'emails (Postmark, Mailgun, SendGrid, format générique).
 * Protégé par INBOUND_EMAIL_TOKEN, transmis en en-tête `x-fluxia-token` ou en `?token=`.
 */
@Public()
@Controller('inbound')
class InboundController {
    constructor(private readonly requests: RequestsService) {}

    @Post('email')
    @HttpCode(200)
    async email(
        @Body() payload: Record<string, unknown>,
        @Headers('x-fluxia-token') header?: string,
        @Query('token') query?: string,
    ) {
        const expected = process.env.INBOUND_EMAIL_TOKEN;
        if (!expected) throw new NotFoundException();
        if (!sameSecret(header ?? query ?? '', expected)) throw new ForbiddenException('Jeton invalide');

        const email = normalizeInbound(payload);
        if (!email) throw new BadRequestException('Email entrant illisible (expéditeur ou texte manquant)');

        const request = await this.requests.ingest(
            {
                fromName: email.fromName.slice(0, 120),
                fromEmail: email.fromEmail,
                subject: email.subject.slice(0, 200),
                body: email.text.slice(0, 10_000),
                attachments: Math.min(50, email.attachments),
            },
            email.externalId,
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
        const [messages, counts] = await Promise.all([
            this.prisma.outboundMessage.findMany({
                where: status ? { status } : undefined,
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
            this.prisma.outboundMessage.groupBy({ by: ['status'], _count: true }),
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
        return this.prisma.outboundMessage.findUniqueOrThrow({ where: { id } });
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
