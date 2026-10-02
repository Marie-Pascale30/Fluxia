import { Controller, Get, Global, Module, Param, Query } from '@nestjs/common';
import { ClientsService } from './clients.service.js';

@Controller('clients')
class ClientsController {
    constructor(private readonly clients: ClientsService) {}

    @Get()
    list(@Query('search') search?: string) {
        return this.clients.findAll(search);
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.clients.findOne(id);
    }
}

@Global()
@Module({
    controllers: [ClientsController],
    providers: [ClientsService],
    exports: [ClientsService],
})
export class ClientsModule {}
