import { Controller, ForbiddenException, Get, Global, Module, Param, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { parseDay } from '../common/dates.js';
import { TechniciansService } from './technicians.service.js';

@Controller('technicians')
class TechniciansController {
    constructor(private readonly technicians: TechniciansService) {}

    @Get()
    list(@Query('date') date?: string) {
        return this.technicians.findAll(parseDay(date));
    }

    @Get(':id')
    @Roles('MANAGER', 'TECHNICIAN')
    get(@Param('id') id: string, @CurrentUser() user: AuthUser, @Query('date') date?: string) {
        if (user.role === 'TECHNICIAN' && user.technicianId !== id) throw new ForbiddenException('Accès limité à vos missions');
        return this.technicians.findOne(id, parseDay(date));
    }
}

@Global()
@Module({
    controllers: [TechniciansController],
    providers: [TechniciansService],
    exports: [TechniciansService],
})
export class TechniciansModule {}
