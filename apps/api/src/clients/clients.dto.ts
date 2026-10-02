import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEmail,
    IsIn,
    IsLatitude,
    IsLongitude,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
    ValidateNested,
} from 'class-validator';
import { EQUIPMENT_TYPES, type EquipmentType } from '../common/domain.js';

export class SiteInputDto {
    @IsString() @MinLength(2) @MaxLength(80) label: string;
    @IsString() @MinLength(3) @MaxLength(160) address: string;
    @IsOptional() @IsString() @MaxLength(10) postalCode?: string;
    @IsOptional() @IsString() @MaxLength(80) city?: string;
    /** Coordonnées manuelles (sinon géocodage automatique) */
    @IsOptional() @IsLatitude() lat?: number;
    @IsOptional() @IsLongitude() lng?: number;
}

export class UpdateSiteDto {
    @IsOptional() @IsString() @MinLength(2) @MaxLength(80) label?: string;
    @IsOptional() @IsString() @MinLength(3) @MaxLength(160) address?: string;
    @IsOptional() @IsString() @MaxLength(10) postalCode?: string;
    @IsOptional() @IsString() @MaxLength(80) city?: string;
    @IsOptional() @IsLatitude() lat?: number;
    @IsOptional() @IsLongitude() lng?: number;
}

export class CreateClientDto {
    @IsString() @MinLength(2) @MaxLength(120) name: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() @MaxLength(30) phone?: string;
    @IsOptional() @IsString() @MaxLength(120) contactName?: string;

    /** Premier site (facultatif) */
    @IsOptional() @ValidateNested() @Type(() => SiteInputDto) site?: SiteInputDto;
}

export class UpdateClientDto {
    @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() @MaxLength(30) phone?: string;
    @IsOptional() @IsString() @MaxLength(120) contactName?: string;
}

export class EquipmentInputDto {
    @IsIn(EQUIPMENT_TYPES) type: EquipmentType;
    @IsString() @MinLength(2) @MaxLength(120) label: string;
    @IsOptional() @IsString() @MaxLength(60) brand?: string;
    @IsOptional() @IsString() @MaxLength(60) model?: string;
    @IsOptional() @IsDateString() installedAt?: string;
}

export class UpdateEquipmentDto {
    @IsOptional() @IsIn(EQUIPMENT_TYPES) type?: EquipmentType;
    @IsOptional() @IsString() @MinLength(2) @MaxLength(120) label?: string;
    @IsOptional() @IsString() @MaxLength(60) brand?: string;
    @IsOptional() @IsString() @MaxLength(60) model?: string;
}

export class ContractInputDto {
    @IsString() @MinLength(3) @MaxLength(40) reference: string;
    @IsString() @MinLength(3) @MaxLength(160) label: string;
    @IsDateString() startDate: string;
    @IsDateString() endDate: string;
    @IsBoolean() coversLabor: boolean;
    @IsBoolean() coversParts: boolean;
    @IsBoolean() coversTravel: boolean;
    @IsOptional() @IsDateString() nextServiceDate?: string;
}

export class UpdateContractDto {
    @IsOptional() @IsString() @MinLength(3) @MaxLength(160) label?: string;
    @IsOptional() @IsDateString() startDate?: string;
    @IsOptional() @IsDateString() endDate?: string;
    @IsOptional() @IsBoolean() coversLabor?: boolean;
    @IsOptional() @IsBoolean() coversParts?: boolean;
    @IsOptional() @IsBoolean() coversTravel?: boolean;
    @IsOptional() @IsDateString() nextServiceDate?: string;
}
