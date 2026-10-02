import { Injectable, NotFoundException } from '@nestjs/common';
import { endOfDay, startOfDay } from '../common/dates.js';
import { PLANNED_STATUSES } from '../common/domain.js';
import { PrismaService } from '../prisma/prisma.service.js';

const missionInclude = {
    client: true,
    site: true,
    equipment: true,
    report: { select: { id: true, status: true } },
    attachments: { orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, filename: true, mimeType: true, size: true, caption: true, uploadedBy: true, createdAt: true } },
} as const;

@Injectable()
export class TechniciansService {
    constructor(private readonly prisma: PrismaService) {}

    /** Liste avec la charge du jour (nombre d'interventions et minutes planifiées). */
    async findAll(day = new Date(), includeInactive = false) {
        const technicians = await this.prisma.technician.findMany({
            where: includeInactive ? {} : { active: true },
            orderBy: { firstName: 'asc' },
            include: {
                interventions: {
                    where: {
                        status: { in: PLANNED_STATUSES },
                        scheduledStart: { gte: startOfDay(day), lt: endOfDay(day) },
                    },
                    orderBy: { scheduledStart: 'asc' },
                    select: { id: true, number: true, title: true, status: true, scheduledStart: true, scheduledEnd: true },
                },
            },
        });

        return technicians.map(({ interventions, ...t }) => ({
            ...t,
            today: interventions,
            plannedMinutes: interventions.reduce(
                (sum, i) => sum + (i.scheduledEnd!.getTime() - i.scheduledStart!.getTime()) / 60_000,
                0,
            ),
        }));
    }

    async findRaw() {
        const technicians = await this.prisma.technician.findMany({ where: { active: true } });
        return technicians;
    }

    /** Vue terrain : missions du technicien pour un jour donné. */
    async findOne(id: string, day = new Date()) {
        const technician = await this.prisma.technician.findUnique({ where: { id } });
        if (!technician) throw new NotFoundException('Technicien introuvable');

        const missions = await this.prisma.intervention.findMany({
            where: {
                technicianId: id,
                status: { in: PLANNED_STATUSES },
                scheduledStart: { gte: startOfDay(day), lt: endOfDay(day) },
            },
            orderBy: { scheduledStart: 'asc' },
            include: missionInclude,
        });

        return { ...technician, missions };
    }
}
