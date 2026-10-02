import { Controller, Get, Global, Module } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';

@Controller('catalog')
class CatalogController {
    constructor(private readonly catalog: CatalogService) {}

    @Get()
    list() {
        return this.catalog.findAll();
    }
}

@Global()
@Module({
    controllers: [CatalogController],
    providers: [CatalogService],
    exports: [CatalogService],
})
export class CatalogModule {}
