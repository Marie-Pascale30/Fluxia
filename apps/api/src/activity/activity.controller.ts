import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ActivityService } from './activity.service.js';

@Controller('activities')
export class ActivityController {
    constructor(private readonly activity: ActivityService) {}

    @Get()
    list(@Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number) {
        return this.activity.recent(Math.min(limit, 100));
    }
}
