import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
    INTERVENTION_STATUSES,
    INTERVENTION_TYPES,
    PRIORITIES,
    type InterventionStatus,
    type InterventionType,
    type Priority,
} from '../common/domain.js';

export class CreateInterventionDto {
    @IsString() clientId: string;
    @IsString() siteId: string;
    @IsOptional() @IsString() equipmentId?: string;
    @IsString() @MinLength(3) @MaxLength(140) title: string;
    @IsString() @MinLength(3) description: string;
    @IsOptional() @IsIn(INTERVENTION_TYPES) type?: InterventionType;
    @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
    @IsOptional() @IsString() initialDiagnosis?: string;
    @IsOptional() @IsInt() @Min(15) @Max(600) estimatedMinutes?: number;
}

export class AssignInterventionDto {
    @IsString() technicianId: string;
    @IsDateString() start: string;
    @IsOptional() @IsInt() @Min(15) @Max(600) durationMinutes?: number;
}

export class CancelInterventionDto {
    @IsString() @MinLength(3) reason: string;
}

export class SubmitReportDto {
    @IsString() @MinLength(15, { message: 'Le compte rendu doit faire au moins 15 caractères' }) voiceNote: string;
}

export class ListInterventionsQuery {
    @IsOptional() @IsIn(INTERVENTION_STATUSES) status?: InterventionStatus;
    @IsOptional() @IsString() technicianId?: string;
    @IsOptional() @IsString() clientId?: string;
}
