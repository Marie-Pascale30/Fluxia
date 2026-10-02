import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { parseDay } from '../common/dates.js';
import { PlanningService } from './planning.service.js';

@Controller('planning')
class PlanningController {
    constructor(private readonly planning: PlanningService) {}

    @Get()
    day(@Query('date') date?: string) {
        return this.planning.getDay(parseDay(date));
    }
}

@Global()
@Module({
    controllers: [PlanningController],
    providers: [PlanningService],
    exports: [PlanningService],
})
export class PlanningModule {}
