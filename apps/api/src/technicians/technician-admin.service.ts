import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEmail,
    IsIn,
    IsLatitude,
    IsLongitude,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';
import { ActivityService } from '../activity/activity.service.js';
import { hashPassword } from '../auth/password.js';
import { EQUIPMENT_TYPES, type EquipmentType } from '../common/domain.js';
import { GeoService } from '../geo/geo.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class TechnicianInputDto {
    @IsString() @MinLength(2) @MaxLength(60) firstName: string;
    @IsString() @MinLength(2) @MaxLength(60) lastName: string;
    @IsEmail() email: string;
    @IsOptional() @IsString() @MaxLength(30) phone?: string;
    @IsArray() @ArrayMinSize(1) @IsIn(EQUIPMENT_TYPES, { each: true }) skills: EquipmentType[];
    /** Adresse de départ (géocodée) ou coordonnées */
    @IsOptional() @IsString() @MinLength(3) baseAddress?: string;
    @IsOptional() @Type(() => Number) @IsLatitude() baseLat?: number;
    @IsOptional() @Type(() => Number) @IsLongitude() baseLng?: number;
}

export class UpdateTechnicianDto {
    @IsOptional() @IsString() @MinLength(2) @MaxLength(60) firstName?: string;
    @IsOptional() @IsString() @MinLength(2) @MaxLength(60) lastName?: string;
    @IsOptional() @IsString() @MaxLength(30) phone?: string;
    @IsOptional() @IsArray() @ArrayMinSize(1) @IsIn(EQUIPMENT_TYPES, { each: true }) skills?: EquipmentType[];
    @IsOptional() @IsString() @MinLength(3) baseAddress?: string;
    @IsOptional() @IsBoolean() active?: boolean;
}

/** Mot de passe provisoire lisible (sans caractères ambigus). */
function temporaryPassword() {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join('');
}

@Injectable()
export class TechnicianAdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly geo: GeoService,
        private readonly activity: ActivityService,
    ) {}

    private async base(dto: { baseAddress?: string; baseLat?: number; baseLng?: number }) {
        if (dto.baseLat !== undefined && dto.baseLng !== undefined) return { baseLat: dto.baseLat, baseLng: dto.baseLng };
        if (!dto.baseAddress) return null;
        const found = await this.geo.geocode({ address: dto.baseAddress });
        return { baseLat: found.lat, baseLng: found.lng };
    }

    /** Crée le technicien et son compte ; le mot de passe provisoire n'est renvoyé qu'une fois. */
    async create(dto: TechnicianInputDto) {
        const base = (await this.base(dto)) ?? { baseLat: 48.8566, baseLng: 2.3522 };
        const password = temporaryPassword();
        const email = dto.email.toLowerCase();
        try {
            const technician = await this.prisma.$transaction(async (tx) => {
                const created = await tx.technician.create({
                    data: { firstName: dto.firstName, lastName: dto.lastName, email, phone: dto.phone, skills: dto.skills, ...base },
                });
                await tx.user.create({
                    data: {
                        email,
                        name: `${dto.firstName} ${dto.lastName}`,
                        role: 'TECHNICIAN',
                        technicianId: created.id,
                        passwordHash: await hashPassword(password),
                    },
                });
                await this.activity.log(
                    { actor: 'USER', type: 'TECHNICIAN_CREATED', message: `Technicien ${created.firstName} ${created.lastName} ajouté`, entityType: 'TECHNICIAN', entityId: created.id },
                    tx,
                );
                return created;
            });
            return { technician, temporaryPassword: password };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(`Un compte existe déjà pour ${email}`);
            }
            throw error;
        }
    }

    async update(id: string, dto: UpdateTechnicianDto) {
        const technician = await this.prisma.technician.findUnique({ where: { id } });
        if (!technician) throw new NotFoundException('Technicien introuvable');

        if (dto.active === false && technician.active) {
            const upcoming = await this.prisma.intervention.count({
                where: { technicianId: id, status: { in: ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS'] } },
            });
            if (upcoming) {
                throw new ConflictException(`${technician.firstName} a encore ${upcoming} intervention(s) planifiée(s) : réaffectez-les avant de le désactiver`);
            }
        }

        const base = await this.base(dto);
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.technician.update({
                where: { id },
                data: {
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    phone: dto.phone,
                    skills: dto.skills,
                    active: dto.active,
                    ...(base ?? {}),
                },
            });
            // Le compte suit le statut et le nom du technicien
            await tx.user.updateMany({
                where: { technicianId: id },
                data: { active: updated.active, name: `${updated.firstName} ${updated.lastName}` },
            });
            if (dto.active !== undefined && dto.active !== technician.active) {
                await this.activity.log(
                    {
                        actor: 'USER',
                        type: dto.active ? 'TECHNICIAN_ENABLED' : 'TECHNICIAN_DISABLED',
                        message: `${updated.firstName} ${updated.lastName} ${dto.active ? 'réactivé' : 'désactivé'}`,
                        entityType: 'TECHNICIAN',
                        entityId: id,
                    },
                    tx,
                );
            }
            return updated;
        });
    }

    async resetPassword(id: string) {
        const user = await this.prisma.user.findUnique({ where: { technicianId: id } });
        if (!user) throw new NotFoundException("Ce technicien n'a pas de compte");
        const password = temporaryPassword();
        await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
        await this.activity.log({ actor: 'USER', type: 'PASSWORD_RESET', message: `Mot de passe de ${user.name} réinitialisé`, entityType: 'TECHNICIAN', entityId: id });
        return { temporaryPassword: password };
    }
}
