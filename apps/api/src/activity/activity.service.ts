import { Injectable } from '@nestjs/common';
import type { ActivityActor } from '../common/domain.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

export interface ActivityInput {
    actor: ActivityActor;
    type: string;
    message: string;
    entityType: string;
    entityId: string;
}

export interface OutboundInput {
    recipient: string;
    subject: string;
    body: string;
    entityType: string;
    entityId: string;
    channel?: 'EMAIL' | 'SMS' | 'PUSH';
}

/** Traçabilité : journal d'audit + messages sortants (simulés, jamais réellement envoyés). */
@Injectable()
export class ActivityService {
    constructor(private readonly prisma: PrismaService) {}

    log(input: ActivityInput, tx: Tx = this.prisma) {
        return tx.activity.create({ data: input });
    }

    sendMessage(input: OutboundInput, tx: Tx = this.prisma) {
        return tx.outboundMessage.create({ data: { channel: 'EMAIL', ...input } });
    }

    recent(limit = 15) {
        return this.prisma.activity.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    }

    /** Historique d'une entité et de ses entités liées (ex. intervention + rapport + devis). */
    forEntities(entityIds: string[]) {
        return this.prisma.activity.findMany({
            where: { entityId: { in: entityIds } },
            orderBy: { createdAt: 'asc' },
        });
    }

    messagesFor(entityIds: string[]) {
        return this.prisma.outboundMessage.findMany({
            where: { entityId: { in: entityIds } },
            orderBy: { createdAt: 'asc' },
        });
    }
}
