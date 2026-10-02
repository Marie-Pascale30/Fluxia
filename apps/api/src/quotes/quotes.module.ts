import { Body, Controller, Get, Global, HttpCode, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
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

    @Post(':id/:transition')
    @HttpCode(200)
    transition(@Param('id') id: string, @Param('transition') transition: string) {
        switch (transition) {
            case 'validate':
                return this.quotes.validate(id);
            case 'reopen':
                return this.quotes.reopen(id);
            case 'send':
                return this.quotes.send(id);
            case 'accept':
                return this.quotes.accept(id);
            case 'refuse':
                return this.quotes.refuse(id);
            default:
                throw new NotFoundException(`Transition inconnue : ${transition}`);
        }
    }
}

@Global()
@Module({
    controllers: [QuotesController],
    providers: [QuotesService],
    exports: [QuotesService],
})
export class QuotesModule {}
