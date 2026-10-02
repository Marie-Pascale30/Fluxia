import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { QUOTE_LINE_KINDS, QUOTE_STATUSES, type QuoteLineKind, type QuoteStatus } from '../common/domain.js';

export class QuoteLineDto {
    @IsIn(QUOTE_LINE_KINDS) kind: QuoteLineKind;
    @IsString() @MinLength(1) @MaxLength(200) label: string;
    @IsNumber() @Min(0.01) @Max(10_000) quantity: number;
    @IsInt() @Min(0) unitPriceCents: number;
    @IsOptional() @IsString() catalogCode?: string;
}

export class UpdateQuoteDto {
    @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
    @IsOptional() @IsString() @MaxLength(2000) notes?: string;
    @IsOptional() @IsNumber() @Min(0) @Max(0.3) vatRate?: number;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => QuoteLineDto)
    lines?: QuoteLineDto[];
}

export class ListQuotesQuery {
    @IsOptional() @IsIn(QUOTE_STATUSES) status?: QuoteStatus;
}
