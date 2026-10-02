import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';

export class ReportPartDto {
    @IsString() @MinLength(1) label: string;
    @IsOptional() @IsString() catalogCode?: string | null;
    @IsNumber() @Min(0.01) quantity: number;
}

export class UpdateReportDto {
    @IsOptional() @IsString() @MinLength(3) reason?: string;
    @IsOptional() @IsString() @MinLength(3) diagnosis?: string;
    @IsOptional() @IsString() @MinLength(3) workDone?: string;
    @IsOptional() @IsString() @MinLength(3) result?: string;
    @IsOptional() @IsString() recommendation?: string;
    @IsOptional() @IsNumber() @Min(0) @Max(24) laborHours?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReportPartDto)
    parts?: ReportPartDto[];
}
