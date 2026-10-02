import { Body, ConflictException, Controller, Get, Global, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { QUOTE_LINE_KINDS, type QuoteLineKind } from '../common/domain.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogService } from './catalog.service.js';

class CatalogItemDto {
    @IsString() @Matches(/^[A-Z0-9-]{2,20}$/, { message: 'Code : 2 à 20 caractères parmi A-Z, 0-9 et -' }) code: string;
    @IsIn(QUOTE_LINE_KINDS) kind: QuoteLineKind;
    @IsString() @MinLength(2) @MaxLength(160) label: string;
    @IsInt() @Min(0) unitPriceCents: number;
    @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

class UpdateCatalogItemDto {
    @IsOptional() @IsIn(QUOTE_LINE_KINDS) kind?: QuoteLineKind;
    @IsOptional() @IsString() @MinLength(2) @MaxLength(160) label?: string;
    @IsOptional() @IsInt() @Min(0) unitPriceCents?: number;
    @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

const cleanKeywords = (list?: string[]) =>
    list?.map((k) => k.trim().toLowerCase()).filter(Boolean);

@Controller('catalog')
class CatalogController {
    constructor(
        private readonly catalog: CatalogService,
        private readonly prisma: PrismaService,
    ) {}

    @Get()
    list() {
        return this.catalog.findAll();
    }

    @Post()
    async create(@Body() dto: CatalogItemDto) {
        try {
            return await this.prisma.catalogItem.create({ data: { ...dto, keywords: cleanKeywords(dto.keywords) ?? [] } });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(`Le code ${dto.code} existe déjà`);
            }
            throw error;
        }
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
        const item = await this.prisma.catalogItem.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Article introuvable');
        return this.prisma.catalogItem.update({ where: { id }, data: { ...dto, keywords: cleanKeywords(dto.keywords) } });
    }
}

@Global()
@Module({
    controllers: [CatalogController],
    providers: [CatalogService],
    exports: [CatalogService],
})
export class CatalogModule {}
