import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivityModule } from './activity/activity.module.js';
import { AuthModule } from './auth/auth.module.js';
import { Public } from './auth/decorators.js';
import { AiModule } from './ai/ai.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { GeoModule } from './geo/geo.service.js';
import { InterventionsModule } from './interventions/interventions.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { PlanningModule } from './planning/planning.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RequestsModule } from './requests/requests.module.js';
import { TechniciansModule } from './technicians/technicians.module.js';

@Public()
@Controller('health')
class HealthController {
    @Get()
    health() {
        return { status: 'ok' };
    }
}

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        // Infrastructure
        PrismaModule,
        AuthModule,
        ActivityModule,
        AiModule,
        GeoModule,
        // Référentiels
        CatalogModule,
        ClientsModule,
        TechniciansModule,
        // Métier
        PlanningModule,
        InterventionsModule,
        QuotesModule,
        ReportsModule,
        RequestsModule,
        DashboardModule,
        MessagingModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
