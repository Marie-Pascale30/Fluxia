import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
    INTERVENTION_TYPES,
    PRIORITIES,
    REQUEST_CATEGORIES,
    REQUEST_CHANNELS,
    REQUEST_STATUSES,
    type InterventionType,
    type Priority,
    type RequestCategory,
    type RequestChannel,
    type RequestStatus,
} from '../common/domain.js';

export class IngestRequestDto {
    @IsOptional() @IsIn(REQUEST_CHANNELS) channel?: RequestChannel;
    @IsString() @MinLength(2) @MaxLength(120) fromName: string;
    @IsEmail() fromEmail: string;
    @IsString() @MinLength(3) @MaxLength(200) subject: string;
    @IsString() @MinLength(10) @MaxLength(10_000) body: string;
    @IsOptional() @IsInt() @Min(0) @Max(50) attachments?: number;
}

/** Correction humaine de l'analyse IA. */
export class UpdateRequestDto {
    @IsOptional() @IsIn(REQUEST_CATEGORIES) category?: RequestCategory;
    @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
    @IsOptional() @IsString() clientId?: string;
    @IsOptional() @IsString() siteId?: string;
    @IsOptional() @IsString() equipmentId?: string;
}

export class ConvertRequestDto {
    @IsOptional() @IsString() @MinLength(3) @MaxLength(140) title?: string;
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
    @IsOptional() @IsIn(INTERVENTION_TYPES) type?: InterventionType;
    @IsOptional() @IsInt() @Min(15) @Max(600) estimatedMinutes?: number;
}

export class ListRequestsQuery {
    @IsOptional() @IsIn(REQUEST_STATUSES) status?: RequestStatus;
}
