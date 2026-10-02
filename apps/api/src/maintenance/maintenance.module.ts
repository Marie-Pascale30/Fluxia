import { Controller, DefaultValuePipe, Get, HttpCode, Injectable, Logger, Module, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ActivityService } from '../activity/activity.service.js';
import { addDays, addMonths, APP_TIMEZONE, formatShortDateFr, startOfDay } from '../common/dates.js';
import { InterventionsService } from '../interventions/interventions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const OPEN = { notIn: ['CLOSED', 'CANCELLED'] as ('CLOSED' | 'CANCELLED')[] };

/**
 * Entretien préventif : les contrats dont l'échéance d'entretien approche donnent lieu
 * à une intervention « Entretien » par site, à planifier. Idempotent : aucune intervention
 * n'est recréée tant qu'une autre, issue du même contrat et du même site, est ouverte.
 */
@Injectable()
export class MaintenanceService {
    private readonly logger = new Logger(MaintenanceService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly interventions: InterventionsService,
        private readonly activity: ActivityService,
    ) {}

    /** Contrats dont l'entretien tombe dans les `days` prochains jours, ou déjà programmé et non réalisé. */
    upcoming(days = 60) {
        const now = new Date();
        return this.prisma.contract.findMany({
            where: {
                endDate: { gte: now },
                OR: [
                    { nextServiceDate: { not: null, lte: addDays(startOfDay(now), days) } },
                    { interventions: { some: { status: OPEN } } },
                ],
            },
            orderBy: { nextServiceDate: 'asc' },
            include: {
                client: { select: { id: true, name: true } },
                interventions: { where: { status: OPEN }, select: { id: true, number: true, status: true } },
            },
        });
    }

    async generate(horizonDays = 30) {
        const now = new Date();
        const horizon = addDays(startOfDay(now), horizonDays);
        const contracts = await this.prisma.contract.findMany({
            where: { endDate: { gte: now }, nextServiceDate: { not: null, lte: horizon } },
            include: { client: { include: { sites: { include: { equipments: true } } } } },
        });

        const created: { id: string; number: number; client: string }[] = [];
        for (const contract of contracts) {
            const due = contract.nextServiceDate!;
            await this.prisma.$transaction(async (tx) => {
                for (const site of contract.client.sites) {
                    const open = await tx.intervention.findFirst({
                        where: { contractId: contract.id, siteId: site.id, type: 'MAINTENANCE', status: OPEN },
                    });
                    if (open) continue;

                    const intervention = await this.interventions.create(
                        {
                            clientId: contract.clientId,
                            siteId: site.id,
                            equipmentId: site.equipments.length === 1 ? site.equipments[0].id : undefined,
                            title: `Entretien périodique — ${site.label}`,
                            description: `Visite d'entretien prévue au contrat ${contract.reference} (échéance du ${formatShortDateFr(due)}). Équipements : ${
                                site.equipments.map((e) => e.label).join(', ') || 'à inventorier'
                            }.`,
                            type: 'MAINTENANCE',
                            priority: due < now ? 'HIGH' : 'NORMAL',
                            estimatedMinutes: Math.min(480, 60 + 30 * Math.max(1, site.equipments.length)),
                        },
                        'SYSTEM',
                        undefined,
                        tx,
                    );
                    await tx.intervention.update({ where: { id: intervention.id }, data: { contractId: contract.id } });
                    created.push({ id: intervention.id, number: intervention.number, client: contract.client.name });
                }

                // Prochaine échéance : aucune sans périodicité, ni au-delà de la fin du contrat
                const candidate = contract.serviceIntervalMonths ? addMonths(due, contract.serviceIntervalMonths) : null;
                const next = candidate && candidate <= contract.endDate ? candidate : null;
                await tx.contract.update({ where: { id: contract.id }, data: { nextServiceDate: next } });
                await this.activity.log(
                    {
                        actor: 'SYSTEM',
                        type: 'MAINTENANCE_GENERATED',
                        message: `Entretien du contrat ${contract.reference} programmé${next ? `, prochain le ${formatShortDateFr(next)}` : ''}`,
                        entityType: 'CLIENT',
                        entityId: contract.clientId,
                    },
                    tx,
                );
            });
        }
        if (created.length) this.logger.log(`${created.length} entretien(s) préventif(s) créé(s)`);
        return { contracts: contracts.length, created };
    }

    /** Chaque matin à 6 h (fuseau métier). Désactivable : MAINTENANCE_AUTO=false. */
    @Cron('0 6 * * *', { timeZone: APP_TIMEZONE, name: 'preventive-maintenance' })
    async daily() {
        if (process.env.MAINTENANCE_AUTO === 'false') return;
        try {
            await this.generate(Number(process.env.MAINTENANCE_HORIZON_DAYS ?? 30));
        } catch (error) {
            this.logger.error(`Génération des entretiens impossible : ${(error as Error).message}`);
        }
    }
}

@Controller('maintenance')
class MaintenanceController {
    constructor(private readonly maintenance: MaintenanceService) {}

    @Get('upcoming')
    upcoming(@Query('days', new DefaultValuePipe(60), ParseIntPipe) days: number) {
        return this.maintenance.upcoming(Math.min(days, 365));
    }

    @Post('run')
    @HttpCode(200)
    run(@Query('horizon', new DefaultValuePipe(30), ParseIntPipe) horizon: number) {
        return this.maintenance.generate(Math.min(Math.max(horizon, 0), 180));
    }
}

@Module({
    controllers: [MaintenanceController],
    providers: [MaintenanceService],
})
export class MaintenanceModule {}
