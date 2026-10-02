import { Body, Controller, Get, HttpCode, Module, Param, Patch, Post } from '@nestjs/common';
import { UpdateReportDto } from './reports.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
class ReportsController {
    constructor(private readonly reports: ReportsService) {}

    @Get()
    list() {
        return this.reports.list();
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.reports.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateReportDto) {
        return this.reports.update(id, dto);
    }

    @Post(':id/validate')
    @HttpCode(200)
    validate(@Param('id') id: string) {
        return this.reports.validate(id);
    }

    @Post(':id/reopen')
    @HttpCode(200)
    reopen(@Param('id') id: string) {
        return this.reports.reopen(id);
    }

    @Post(':id/send')
    @HttpCode(200)
    send(@Param('id') id: string) {
        return this.reports.send(id);
    }

    @Post(':id/quote')
    createQuote(@Param('id') id: string) {
        return this.reports.createQuote(id);
    }
}

@Module({
    controllers: [ReportsController],
    providers: [ReportsService],
})
export class ReportsModule {}
