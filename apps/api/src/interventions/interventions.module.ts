import { Global, Module } from '@nestjs/common';
import { InterventionsController } from './interventions.controller.js';
import { InterventionsService } from './interventions.service.js';

@Global()
@Module({
    controllers: [InterventionsController],
    providers: [InterventionsService],
    exports: [InterventionsService],
})
export class InterventionsModule {}
