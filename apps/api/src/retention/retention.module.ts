import { Injectable, Logger, Module, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { APP_TIMEZONE } from '../common/dates.js';
import { asSystem } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cutoff, RETENTION } from './retention.js';

/**
 * Purge automatique des données au-delà de leur durée de conservation (RGPD, minimisation) :
 * chaque nuit, et une fois au démarrage (l'hébergement de démo s'endort en cas d'inactivité
 * et peut manquer l'heure de la tâche). Désactivable : RETENTION_PURGE=false.
 */
@Injectable()
export class RetentionService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(RetentionService.name);
    private timer?: NodeJS.Timeout;

    constructor(private readonly prisma: PrismaService) {}

    private get enabled() {
        return process.env.RETENTION_PURGE !== 'false';
    }

    onApplicationBootstrap() {
        if (!this.enabled) return;
        this.timer = setTimeout(() => void this.daily(), 60_000);
        this.timer.unref();
    }

    onModuleDestroy() {
        clearTimeout(this.timer);
    }

    @Cron('30 3 * * *', { timeZone: APP_TIMEZONE, name: 'retention-purge' })
    async daily() {
        if (!this.enabled) return;
        try {
            await this.purge();
        } catch (error) {
            this.logger.error(`Purge de conservation impossible : ${(error as Error).message}`);
        }
    }

    /** Supprime, toutes entreprises confondues, ce qui a dépassé sa durée de conservation. */
    async purge(now = new Date()) {
        // Traitement transverse : mêmes règles pour toutes les entreprises
        const [requests, messages, activities] = await asSystem(() =>
            Promise.all([
                this.prisma.inboundRequest.deleteMany({
                    where: { status: 'ARCHIVED', receivedAt: { lt: cutoff(RETENTION.archivedRequestsMonths, now) } },
                }),
                this.prisma.outboundMessage.deleteMany({
                    where: { createdAt: { lt: cutoff(RETENTION.outboundMessagesMonths, now) }, status: { not: 'PENDING' } },
                }),
                this.prisma.activity.deleteMany({ where: { createdAt: { lt: cutoff(RETENTION.activityMonths, now) } } }),
            ]),
        );
        const result = { requests: requests.count, messages: messages.count, activities: activities.count };
        if (result.requests || result.messages || result.activities) {
            this.logger.log(`Purge de conservation : ${result.requests} demande(s), ${result.messages} message(s), ${result.activities} entrée(s) de journal`);
        }
        return result;
    }
}

@Module({ providers: [RetentionService], exports: [RetentionService] })
export class RetentionModule {}
