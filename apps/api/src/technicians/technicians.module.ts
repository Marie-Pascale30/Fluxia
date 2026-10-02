import { Body, Controller, ForbiddenException, Get, Global, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { parseDay } from '../common/dates.js';
import { TechnicianAdminService, TechnicianInputDto, UpdateTechnicianDto } from './technician-admin.service.js';
import { TechniciansService } from './technicians.service.js';

@Controller('technicians')
class TechniciansController {
    constructor(
        private readonly technicians: TechniciansService,
        private readonly admin: TechnicianAdminService,
    ) {}

    @Get()
    list(@Query('date') date?: string, @Query('includeInactive') includeInactive?: string) {
        return this.technicians.findAll(parseDay(date), includeInactive === 'true');
    }

    @Get(':id')
    @Roles('MANAGER', 'TECHNICIAN')
    get(@Param('id') id: string, @CurrentUser() user: AuthUser, @Query('date') date?: string) {
        if (user.role === 'TECHNICIAN' && user.technicianId !== id) throw new ForbiddenException('Accès limité à vos missions');
        return this.technicians.findOne(id, parseDay(date));
    }

    @Post()
    create(@Body() dto: TechnicianInputDto) {
        return this.admin.create(dto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateTechnicianDto) {
        return this.admin.update(id, dto);
    }

    @Post(':id/reset-password')
    @HttpCode(200)
    resetPassword(@Param('id') id: string) {
        return this.admin.resetPassword(id);
    }
}

@Global()
@Module({
    controllers: [TechniciansController],
    providers: [TechniciansService, TechnicianAdminService],
    exports: [TechniciansService],
})
export class TechniciansModule {}
