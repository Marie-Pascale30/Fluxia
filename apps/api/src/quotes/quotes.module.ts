import { Body, Controller, Get, Global, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ListQuotesQuery, UpdateQuoteDto } from './quotes.dto.js';
import { QuotesService } from './quotes.service.js';

@Controller('quotes')
class QuotesController {
    constructor(private readonly quotes: QuotesService) {}

    @Get()
    list(@Query() query: ListQuotesQuery) {
        return this.quotes.list(query);
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.quotes.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
        return this.quotes.update(id, dto);
    }

    // Transitions explicites (une route générique ":id/:transition" masquerait d'autres routes)
    @Post(':id/validate')
    @HttpCode(200)
    validate(@Param('id') id: string) {
        return this.quotes.validate(id);
    }

    @Post(':id/reopen')
    @HttpCode(200)
    reopen(@Param('id') id: string) {
        return this.quotes.reopen(id);
    }

    @Post(':id/send')
    @HttpCode(200)
    send(@Param('id') id: string) {
        return this.quotes.send(id);
    }

    @Post(':id/accept')
    @HttpCode(200)
    accept(@Param('id') id: string) {
        return this.quotes.accept(id);
    }

    @Post(':id/refuse')
    @HttpCode(200)
    refuse(@Param('id') id: string) {
        return this.quotes.refuse(id);
    }
}

@Global()
@Module({
    controllers: [QuotesController],
    providers: [QuotesService],
    exports: [QuotesService],
})
export class QuotesModule {}
