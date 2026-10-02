import { Injectable, NotFoundException } from '@nestjs/common';
import { addMinutes, endOfDay, startOfDay } from '../common/dates.js';
import { PLANNED_STATUSES, type EquipmentType, type Priority } from '../common/domain.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { TechniciansService } from '../technicians/technicians.service.js';
import { isFree, recommendTechnicians, searchDays, type TimeRange } from './scheduler.js';

@Injectable()
export class PlanningService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly technicians: TechniciansService,
    ) {}

    /** Planning d'une journée : colonnes techniciens + interventions à planifier. */
    async getDay(day: Date) {
        const [technicians, unscheduled] = await Promise.all([
            this.technicians.findRaw(),
            this.prisma.intervention.findMany({
                where: { status: 'TO_SCHEDULE' },
                orderBy: [{ createdAt: 'asc' }],
                include: { client: true, site: true },
            }),
        ]);

        const interventions = await this.prisma.intervention.findMany({
            where: {
                status: { in: PLANNED_STATUSES },
                scheduledStart: { gte: startOfDay(day), lt: endOfDay(day) },
            },
            orderBy: { scheduledStart: 'asc' },
            include: { client: true, site: true },
        });

        return {
            date: startOfDay(day),
            technicians: technicians
                .sort((a, b) => a.firstName.localeCompare(b.firstName))
                .map((t) => ({ ...t, interventions: interventions.filter((i) => i.technicianId === t.id) })),
            unscheduled,
        };
    }

    private async busyRanges(technicianId: string, from: Date, to: Date, excludeInterventionId?: string, tx: Tx = this.prisma) {
        const rows = await tx.intervention.findMany({
            where: {
                technicianId,
                id: excludeInterventionId ? { not: excludeInterventionId } : undefined,
                status: { in: PLANNED_STATUSES },
                scheduledStart: { lt: to },
                scheduledEnd: { gt: from },
            },
            select: { scheduledStart: true, scheduledEnd: true },
        });
        return rows.map((r): TimeRange => ({ start: r.scheduledStart!, end: r.scheduledEnd! }));
    }

    /** Refuse un créneau qui chevauche le planning du technicien (marge incluse). */
    async assertSlotAvailable(technicianId: string, slot: TimeRange, excludeInterventionId: string, tx: Tx = this.prisma) {
        const busy = await this.busyRanges(technicianId, addMinutes(slot.start, -60), addMinutes(slot.end, 60), excludeInterventionId, tx);
        return isFree(slot, busy);
    }

    async recommend(interventionId: string, fromDay?: Date) {
        const intervention = await this.prisma.intervention.findUnique({
            where: { id: interventionId },
            include: { site: true, equipment: true },
        });
        if (!intervention) throw new NotFoundException('Intervention introuvable');

        const now = new Date();
        const priority = intervention.priority as Priority;
        const days = searchDays(fromDay ?? now, priority);
        const windowStart = startOfDay(days[0]);
        const windowEnd = endOfDay(days[days.length - 1]);

        const technicians = await this.technicians.findRaw();
        const history = await this.prisma.intervention.groupBy({
            by: ['technicianId', 'equipmentId'],
            where: {
                siteId: intervention.siteId,
                technicianId: { not: null },
                status: { in: ['COMPLETED', 'CLOSED'] },
                id: { not: intervention.id },
            },
            _count: true,
        });

        const candidates = await Promise.all(
            technicians.map(async (t) => {
                const rows = history.filter((h) => h.technicianId === t.id);
                return {
                    id: t.id,
                    name: `${t.firstName} ${t.lastName}`,
                    skills: t.skills,
                    baseLat: t.baseLat,
                    baseLng: t.baseLng,
                    busy: await this.busyRanges(t.id, windowStart, windowEnd, intervention.id),
                    siteHistory: rows.reduce((sum, r) => sum + r._count, 0),
                    equipmentHistory: intervention.equipmentId
                        ? rows.filter((r) => r.equipmentId === intervention.equipmentId).reduce((s, r) => s + r._count, 0)
                        : 0,
                };
            }),
        );

        return recommendTechnicians(
            {
                equipmentType: (intervention.equipment?.type as EquipmentType | undefined) ?? null,
                site: { lat: intervention.site.lat, lng: intervention.site.lng },
                durationMinutes: intervention.estimatedMinutes,
                priority,
                now,
                fromDay,
            },
            candidates,
        );
    }
}
