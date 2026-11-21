import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { asSystem, requireOrganizationId } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { verifyPassword } from '../auth/password.js';

export class DeleteOrganizationDto {
    /** Nom exact de l'entreprise, retapé pour confirmer */
    @IsString() @MinLength(1) confirmName: string;
    @IsString() @MinLength(1) password: string;
}

/**
 * Droits RGPD de l'entreprise cliente : portabilité (export complet) et effacement (suppression définitive).
 * Les fichiers déposés (photos, signatures, audio) sont listés dans l'export et supprimés avec l'entreprise.
 */
@Injectable()
export class PrivacyService {
    private readonly logger = new Logger(PrivacyService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    /** Toutes les données de l'entreprise, lisibles et réutilisables (JSON). Aucun mot de passe ni secret. */
    async export() {
        const organizationId = requireOrganizationId();
        const p = this.prisma;
        const [organization, users, technicians, clients, catalog, requests, interventions, reports, quotes, invoices, attachments, activities, messages] =
            await Promise.all([
                p.organization.findUniqueOrThrow({ where: { id: organizationId } }),
                p.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, lastLoginAt: true, technicianId: true } }),
                p.technician.findMany(),
                p.client.findMany({ include: { sites: { include: { equipments: true } }, contracts: true } }),
                p.catalogItem.findMany(),
                p.inboundRequest.findMany(),
                p.intervention.findMany(),
                p.report.findMany(),
                p.quote.findMany({ include: { lines: { orderBy: { position: 'asc' } } } }),
                p.invoice.findMany({ include: { lines: { orderBy: { position: 'asc' } } } }),
                p.attachment.findMany(),
                p.activity.findMany({ orderBy: { createdAt: 'asc' } }),
                p.outboundMessage.findMany({ orderBy: { createdAt: 'asc' } }),
            ]);
        const { inboundToken: _secret, ...company } = organization;
        return {
            format: 'fluxia-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            organization: company,
            users,
            technicians,
            clients,
            catalog,
            requests,
            interventions,
            reports,
            quotes,
            invoices,
            attachments,
            activities,
            messages,
        };
    }

    /** Suppression définitive de l'entreprise, de toutes ses données et de ses fichiers. */
    async deleteOrganization(userId: string, dto: DeleteOrganizationDto) {
        const organizationId = requireOrganizationId();
        const [organization, user] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        ]);
        if (dto.confirmName.trim() !== organization.name) throw new BadRequestException("Le nom saisi ne correspond pas au nom de l'entreprise");
        if (!(await verifyPassword(dto.password, user.passwordHash))) throw new BadRequestException('Mot de passe incorrect');

        const files = await this.prisma.attachment.findMany({ select: { storageKey: true } });
        // La suppression de l'entreprise emporte toutes ses données (clés étrangères en cascade)
        await asSystem(() => this.prisma.organization.delete({ where: { id: organizationId } }));
        for (const { storageKey } of files) await this.storage.remove(storageKey).catch(() => undefined);
        this.logger.warn(`Entreprise ${organizationId} supprimée à la demande de l'utilisateur ${userId} (${files.length} fichier(s))`);
    }
}
