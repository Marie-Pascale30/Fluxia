import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { OutboundMessage } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
    emailTransportFromEnv,
    smsTransportFromEnv,
    type DeliveryReceipt,
    type EmailTransport,
    type OutgoingAttachment,
    type SmsTransport,
} from './transports.js';

export interface AttachmentRef {
    kind: string;
    id: string;
}

type AttachmentResolver = (id: string) => Promise<OutgoingAttachment>;

const MAX_ATTEMPTS = 5;
/** 30 s, 1 min, 2 min, 4 min… */
const backoff = (attempt: number) => 30_000 * 2 ** (attempt - 1);

/**
 * Boîte d'envoi : les messages sont enregistrés en PENDING dans la transaction métier
 * (aucun envoi si la transaction échoue), puis expédiés ici en arrière-plan.
 * Le verrouillage par numéro de tentative permet plusieurs instances de l'API.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(OutboxService.name);
    private readonly email: EmailTransport = emailTransportFromEnv();
    private readonly sms: SmsTransport = smsTransportFromEnv();
    private readonly resolvers = new Map<string, AttachmentResolver>();
    private timer?: NodeJS.Timeout;
    private running = false;

    constructor(private readonly prisma: PrismaService) {}

    onModuleInit() {
        this.logger.log(`Transports : email=${this.email.name}, sms=${this.sms.name}`);
        if (process.env.OUTBOX_DISABLED === 'true') return;
        this.timer = setInterval(() => void this.tick(), Number(process.env.OUTBOX_INTERVAL_MS ?? 2000));
    }

    onModuleDestroy() {
        clearInterval(this.timer);
    }

    get transports() {
        return { email: this.email.name, sms: this.sms.name };
    }

    /** Déclare comment produire une pièce jointe (ex. PDF d'un rapport) au moment de l'envoi. */
    registerAttachment(kind: string, resolver: AttachmentResolver) {
        this.resolvers.set(kind, resolver);
    }

    async tick() {
        if (this.running) return;
        this.running = true;
        try {
            const batch = await this.prisma.outboundMessage.findMany({
                where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
                orderBy: { createdAt: 'asc' },
                take: 20,
            });
            for (const message of batch) await this.deliver(message);
        } catch (error) {
            this.logger.error(`Boîte d'envoi : ${(error as Error).message}`);
        } finally {
            this.running = false;
        }
    }

    private async deliver(message: OutboundMessage) {
        // Réservation : échoue si une autre instance a déjà pris ce message
        const claim = await this.prisma.outboundMessage.updateMany({
            where: { id: message.id, status: 'PENDING', attempts: message.attempts },
            data: { attempts: { increment: 1 } },
        });
        if (claim.count === 0) return;
        const attempt = message.attempts + 1;

        try {
            const receipt = await this.send(message);
            await this.prisma.outboundMessage.update({
                where: { id: message.id },
                data: { status: 'SENT', sentAt: new Date(), transport: receipt.transport, providerId: receipt.providerId, lastError: null },
            });
        } catch (error) {
            const reason = (error as Error).message.slice(0, 500);
            const failed = attempt >= MAX_ATTEMPTS;
            this.logger.warn(`Envoi ${message.channel} vers ${message.recipient} : échec ${attempt}/${MAX_ATTEMPTS} (${reason})`);
            await this.prisma.outboundMessage.update({
                where: { id: message.id },
                data: {
                    status: failed ? 'FAILED' : 'PENDING',
                    lastError: reason,
                    nextAttemptAt: new Date(Date.now() + backoff(attempt)),
                },
            });
        }
    }

    private async send(message: OutboundMessage): Promise<DeliveryReceipt> {
        switch (message.channel) {
            case 'EMAIL':
                return this.email.send({
                    to: message.recipient,
                    subject: message.subject,
                    text: message.body,
                    attachments: await this.attachments(message),
                });
            case 'SMS':
                return this.sms.send(message.recipient, message.body);
            case 'PUSH':
                // Notification interne : la mission apparaît dans la vue terrain du technicien
                return { transport: 'in-app' };
        }
    }

    private async attachments(message: OutboundMessage): Promise<OutgoingAttachment[]> {
        const refs = Array.isArray(message.attachments) ? (message.attachments as unknown as AttachmentRef[]) : [];
        const files: OutgoingAttachment[] = [];
        for (const ref of refs) {
            const resolver = this.resolvers.get(ref.kind);
            if (!resolver) throw new Error(`Pièce jointe inconnue : ${ref.kind}`);
            files.push(await resolver(ref.id));
        }
        return files;
    }

    /** Relance immédiate d'un message en échec (depuis l'interface). */
    async retry(id: string) {
        await this.prisma.outboundMessage.updateMany({
            where: { id, status: 'FAILED' },
            data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date() },
        });
    }
}
