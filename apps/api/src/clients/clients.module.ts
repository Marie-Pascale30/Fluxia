import { Body, Controller, Delete, Get, Global, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientAdminService } from './client-admin.service.js';
import {
    ContractInputDto,
    CreateClientDto,
    EquipmentInputDto,
    SiteInputDto,
    UpdateClientDto,
    UpdateContractDto,
    UpdateEquipmentDto,
    UpdateSiteDto,
} from './clients.dto.js';
import { ClientsService } from './clients.service.js';

@Controller('clients')
class ClientsController {
    constructor(
        private readonly clients: ClientsService,
        private readonly admin: ClientAdminService,
    ) {}

    @Get()
    list(@Query('search') search?: string) {
        return this.clients.findAll(search);
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.clients.findOne(id);
    }

    @Post()
    create(@Body() dto: CreateClientDto) {
        return this.admin.createClient(dto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
        return this.admin.updateClient(id, dto);
    }

    @Post(':id/sites')
    addSite(@Param('id') id: string, @Body() dto: SiteInputDto) {
        return this.admin.addSite(id, dto);
    }

    @Post(':id/contracts')
    addContract(@Param('id') id: string, @Body() dto: ContractInputDto) {
        return this.admin.addContract(id, dto);
    }
}

/** Sous-ressources adressées directement par leur identifiant. */
@Controller()
class ClientResourcesController {
    constructor(private readonly admin: ClientAdminService) {}

    @Patch('sites/:id')
    updateSite(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
        return this.admin.updateSite(id, dto);
    }

    @Post('sites/:id/equipments')
    addEquipment(@Param('id') id: string, @Body() dto: EquipmentInputDto) {
        return this.admin.addEquipment(id, dto);
    }

    @Patch('equipments/:id')
    updateEquipment(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
        return this.admin.updateEquipment(id, dto);
    }

    @Delete('equipments/:id')
    deleteEquipment(@Param('id') id: string) {
        return this.admin.deleteEquipment(id);
    }

    @Patch('contracts/:id')
    updateContract(@Param('id') id: string, @Body() dto: UpdateContractDto) {
        return this.admin.updateContract(id, dto);
    }
}

@Global()
@Module({
    controllers: [ClientsController, ClientResourcesController],
    providers: [ClientsService, ClientAdminService],
    exports: [ClientsService, ClientAdminService],
})
export class ClientsModule {}
