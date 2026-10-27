import { randomBytes } from 'node:crypto';
import { Body, ConflictException, Controller, Get, Global, HttpCode, Injectable, Module, Patch, Post } from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ActivityService } from '../activity/activity.service.js';
import { hashPassword } from '../auth/password.js';
import { asOrganization, asSystem, requireOrganizationId } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class SignupDto {
    @IsString() @MinLength(2) @MaxLength(120) organizationName: string;
    @IsString() @MinLength(2) @MaxLength(120) name: string;
    @IsEmail() email: string;
    @IsString() @MinLength(8) @MaxLength(200) password: string;
}

export class UpdateOrganizationDto {
    @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
    @IsOptional() @IsString() @MaxLength(300) address?: string;
    @IsOptional() @IsString() @MaxLength(40) phone?: string;
    @IsOptional() @IsString() @MaxLength(120) email?: string;
    @IsOptional() @IsString() @MaxLength(500) legal?: string;
    @IsOptional() @IsString() @MaxLength(200) signature?: string;
    @IsOptional() @IsInt() @Min(0) @Max(60) paymentTermsDays?: number;
    @IsOptional() @IsString() @Matches(/^\d{3,10}$/, { message: 'Compte de produits : chiffres uniquement' }) accountRevenue?: string;
    @IsOptional() @IsString() @Matches(/^\d{3,10}$/, { message: 'Compte de TVA : chiffres uniquement' }) accountVat?: string;
}

/** Catalogue de départ d'une nouvelle entreprise : de quoi chiffrer un premier devis. */
const STARTER_CATALOG = [
    { code: 'MO-H', kind: 'LABOR', label: "Main d'œuvre technicien (heure)", unitPriceCents: 7500, keywords: [] },
    { code: 'DEPL', kind: 'TRAVEL', label: 'Forfait déplacement', unitPriceCents: 4500, keywords: [] },
] as const;

const newInboundToken = () => randomBytes(24).toString('base64url');

/** Fiche de l'entreprise : coordonnées des documents, réglages de facturation, réception des emails. */
@Injectable()
export class OrganizationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
    ) {}

    /** Entreprise du contexte courant (utilisateur connecté, portail, tâche planifiée…). */
    current() {
        return this.prisma.organization.findUniqueOrThrow({ where: { id: requireOrganizationId() } });
    }

    async update(dto: UpdateOrganizationDto) {
        const organization = await this.prisma.organization.update({ where: { id: requireOrganizationId() }, data: dto });
        await this.activity.log({ actor: 'USER', type: 'ORGANIZATION_UPDATED', message: "Paramètres de l'entreprise mis à jour", entityType: 'ORGANIZATION', entityId: organization.id });
        return organization;
    }

    /** Nouveau jeton du webhook d'emails entrants : l'ancien cesse immédiatement de fonctionner. */
    async rotateInboundToken() {
        const organization = await this.prisma.organization.update({ where: { id: requireOrganizationId() }, data: { inboundToken: newInboundToken() } });
        await this.activity.log({ actor: 'USER', type: 'INBOUND_TOKEN_ROTATED', message: 'Jeton de réception des emails renouvelé', entityType: 'ORGANIZATION', entityId: organization.id });
        return organization;
    }

    /** Entreprise destinataire d'un email entrant (webhook), d'après son jeton secret. */
    byInboundToken(token: string) {
        if (!token) return Promise.resolve(null);
        return this.prisma.organization.findUnique({ where: { inboundToken: token } });
    }

    /** Toutes les entreprises (tâches planifiées exécutées pour chacune). */
    allIds() {
        return this.prisma.organization.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } }).then((rows) => rows.map((r) => r.id));
    }

    /** Inscription : nouvelle entreprise et son premier compte responsable. */
    async signup(dto: SignupDto) {
        const email = dto.email.toLowerCase().trim();
        // Les emails de connexion sont uniques sur toute la plateforme
        const taken = await asSystem(() => this.prisma.user.findUnique({ where: { email } }));
        if (taken) throw new ConflictException('Un compte existe déjà avec cet email');

        const passwordHash = await hashPassword(dto.password);
        try {
            // Tout ou rien : pas d'entreprise sans son compte responsable
            return await this.prisma.$transaction(async (tx) => {
                const organization = await tx.organization.create({
                    data: { name: dto.organizationName.trim(), email, inboundToken: newInboundToken() },
                });
                return asOrganization(organization.id, async () => {
                    const user = await tx.user.create({ data: { email, name: dto.name.trim(), role: 'MANAGER', passwordHash } });
                    await tx.catalogItem.createMany({ data: STARTER_CATALOG.map((item) => ({ ...item, keywords: [...item.keywords] })) });
                    await this.activity.log({ actor: 'SYSTEM', type: 'ORGANIZATION_CREATED', message: `Entreprise ${organization.name} créée par ${user.name}`, entityType: 'ORGANIZATION', entityId: organization.id }, tx);
                    return user;
                });
            });
        } catch (error) {
            // Inscription simultanée avec le même email
            if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Un compte existe déjà avec cet email');
            throw error;
        }
    }
}

@Controller('organization')
class OrganizationController {
    constructor(private readonly organizations: OrganizationService) {}

    @Get()
    get() {
        return this.organizations.current();
    }

    @Patch()
    update(@Body() dto: UpdateOrganizationDto) {
        return this.organizations.update(dto);
    }

    @Post('inbound-token')
    @HttpCode(200)
    rotate() {
        return this.organizations.rotateInboundToken();
    }
}

@Global()
@Module({
    controllers: [OrganizationController],
    providers: [OrganizationService],
    exports: [OrganizationService],
})
export class OrganizationsModule {}
