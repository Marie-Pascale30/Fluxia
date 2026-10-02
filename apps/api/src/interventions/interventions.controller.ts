import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { parseDay } from '../common/dates.js';
import {
    AssignInterventionDto,
    CancelInterventionDto,
    CreateInterventionDto,
    ListInterventionsQuery,
    SubmitReportDto,
} from './interventions.dto.js';
import { InterventionsService } from './interventions.service.js';

@Controller('interventions')
export class InterventionsController {
    constructor(private readonly interventions: InterventionsService) {}

    @Get()
    list(@Query() query: ListInterventionsQuery) {
        return this.interventions.list(query);
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.interventions.findOne(id);
    }

    @Post()
    create(@Body() dto: CreateInterventionDto) {
        return this.interventions.create(dto);
    }

    @Get(':id/recommendations')
    recommendations(@Param('id') id: string, @Query('date') date?: string) {
        return this.interventions.recommendations(id, date ? parseDay(date) : undefined);
    }

    @Post(':id/assign')
    @HttpCode(200)
    assign(@Param('id') id: string, @Body() dto: AssignInterventionDto) {
        return this.interventions.assign(id, dto);
    }

    @Post(':id/unassign')
    @HttpCode(200)
    unassign(@Param('id') id: string) {
        return this.interventions.unassign(id);
    }

    @Post(':id/dispatch')
    @HttpCode(200)
    dispatch(@Param('id') id: string) {
        return this.interventions.dispatch(id);
    }

    @Post(':id/start')
    @HttpCode(200)
    start(@Param('id') id: string) {
        return this.interventions.start(id);
    }

    @Post(':id/report')
    submitReport(@Param('id') id: string, @Body() dto: SubmitReportDto) {
        return this.interventions.submitReport(id, dto.voiceNote);
    }

    @Post(':id/cancel')
    @HttpCode(200)
    cancel(@Param('id') id: string, @Body() dto: CancelInterventionDto) {
        return this.interventions.cancel(id, dto.reason);
    }
}
