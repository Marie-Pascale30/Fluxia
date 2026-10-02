import { Controller, Get, Global, Module, Param, Query } from '@nestjs/common';
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
    get(@Param('id') id: string, @Query('date') date?: string) {
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
