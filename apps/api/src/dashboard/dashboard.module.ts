import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { AiService } from '../ai/ai.service.js';
import { endOfDay, startOfDay } from '../common/dates.js';
import { PLANNED_STATUSES } from '../common/domain.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { quoteTotals } from '../reports/billing.js';

@Injectable()
class DashboardService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly ai: AiService,
    ) {}

    async summary() {
        const now = new Date();
        const today = { gte: startOfDay(now), lt: endOfDay(now) };
        const [
            requestsTotal,
            requestsPending,
            urgentPending,
            interventionsToday,
            toSchedule,
            toDispatch,
            reportsPending,
            quotesDraft,
            quotesSent,
            messagesFailed,
            invoicesDraft,
            overdue,
            activity,
        ] = await Promise.all([
            this.prisma.inboundRequest.count({ where: { receivedAt: today } }),
            this.prisma.inboundRequest.count({ where: { status: { in: ['NEW', 'ANALYZED'] } } }),
            this.prisma.inboundRequest.count({ where: { status: { in: ['NEW', 'ANALYZED'] }, priority: 'URGENT' } }),
            this.prisma.intervention.count({ where: { status: { in: PLANNED_STATUSES }, scheduledStart: today } }),
            this.prisma.intervention.count({ where: { status: 'TO_SCHEDULE' } }),
            this.prisma.intervention.count({ where: { status: 'SCHEDULED' } }),
            this.prisma.report.count({ where: { status: { in: ['DRAFT', 'VALIDATED'] } } }),
            this.prisma.quote.count({ where: { status: { in: ['DRAFT', 'VALIDATED'] } } }),
            this.prisma.quote.count({ where: { status: 'SENT' } }),
            this.prisma.outboundMessage.count({ where: { status: 'FAILED' } }),
            this.prisma.invoice.count({ where: { status: 'DRAFT' } }),
            this.prisma.invoice.findMany({ where: { status: 'ISSUED', dueAt: { lt: now } }, include: { lines: true } }),
            this.activity.recent(8),
        ]);

        return {
            aiProvider: this.ai.providerName,
            counters: {
                requestsTotal,
                requestsPending,
                urgentPending,
                interventionsToday,
                toSchedule,
                toDispatch,
                reportsPending,
                quotesDraft,
                quotesSent,
                messagesFailed,
                invoicesDraft,
                invoicesOverdue: overdue.length,
                overdueCents: overdue.reduce((s, i) => s + quoteTotals(i.lines, i.vatRate).totalTtcCents, 0),
            },
            activity,
        };
    }
}

@Controller('dashboard')
class DashboardController {
    constructor(private readonly dashboard: DashboardService) {}

    @Get()
    summary() {
        return this.dashboard.summary();
    }
}

@Module({
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule {}
