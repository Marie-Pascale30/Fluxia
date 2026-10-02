import { Body, Controller, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import {
    ConvertRequestDto,
    CreateClientFromRequestDto,
    IngestRequestDto,
    ListRequestsQuery,
    SendReplyDto,
    UpdateRequestDto,
} from './requests.dto.js';
import { RequestsService } from './requests.service.js';

@Controller('requests')
class RequestsController {
    constructor(private readonly requests: RequestsService) {}

    @Get()
    list(@Query() query: ListRequestsQuery) {
        return this.requests.list(query);
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.requests.findOne(id);
    }

    @Post()
    ingest(@Body() dto: IngestRequestDto) {
        return this.requests.ingest(dto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateRequestDto) {
        return this.requests.update(id, dto);
    }

    @Post(':id/analyze')
    @HttpCode(200)
    analyze(@Param('id') id: string) {
        return this.requests.analyze(id);
    }

    @Post(':id/convert')
    convert(@Param('id') id: string, @Body() dto: ConvertRequestDto) {
        return this.requests.convertToIntervention(id, dto);
    }

    @Post(':id/quote')
    quote(@Param('id') id: string) {
        return this.requests.createQuote(id);
    }

    @Post(':id/client')
    createClient(@Param('id') id: string, @Body() dto: CreateClientFromRequestDto) {
        return this.requests.createClient(id, dto);
    }

    @Post(':id/reply-draft')
    @HttpCode(200)
    draftReply(@Param('id') id: string) {
        return this.requests.draftReply(id);
    }

    @Post(':id/reply')
    @HttpCode(200)
    sendReply(@Param('id') id: string, @Body() dto: SendReplyDto) {
        return this.requests.sendReply(id, dto);
    }

    @Post(':id/archive')
    @HttpCode(200)
    archive(@Param('id') id: string) {
        return this.requests.archive(id);
    }
}

@Module({
    controllers: [RequestsController],
    providers: [RequestsService],
})
export class RequestsModule {}
