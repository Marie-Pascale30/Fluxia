import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { GeoService } from '../geo/geo.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type {
    ContractInputDto,
    CreateClientDto,
    EquipmentInputDto,
    SiteInputDto,
    UpdateClientDto,
    UpdateContractDto,
    UpdateEquipmentDto,
    UpdateSiteDto,
} from './clients.dto.js';

const toDate = (value?: string) => (value ? new Date(value) : undefined);

/** Création et modification des fiches clients (sites, équipements, contrats). */
@Injectable()
export class ClientAdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly geo: GeoService,
        private readonly activity: ActivityService,
    ) {}

    /** Coordonnées : saisies manuellement, sinon géocodées depuis l'adresse. */
    private async locate(site: { address: string; postalCode?: string; city?: string; lat?: number; lng?: number }) {
        if (site.lat !== undefined && site.lng !== undefined) {
            return { address: site.address, postalCode: site.postalCode ?? '', city: site.city ?? '', lat: site.lat, lng: site.lng };
        }
        const found = await this.geo.geocode(site);
        return { address: found.label, postalCode: found.postalCode, city: found.city, lat: found.lat, lng: found.lng };
    }

    async createClient(dto: CreateClientDto, tx: Tx = this.prisma) {
        const site = dto.site ? { label: dto.site.label, ...(await this.locate(dto.site)) } : undefined;
        const client = await tx.client.create({
            data: {
                name: dto.name,
                email: dto.email?.toLowerCase(),
                phone: dto.phone,
                contactName: dto.contactName,
                sites: site ? { create: site } : undefined,
            },
            include: { sites: true },
        });
        await this.activity.log(
            { actor: 'USER', type: 'CLIENT_CREATED', message: `Client « ${client.name} » créé`, entityType: 'CLIENT', entityId: client.id },
            tx,
        );
        return client;
    }

    async updateClient(id: string, dto: UpdateClientDto) {
        await this.ensureClient(id);
        return this.prisma.client.update({ where: { id }, data: { ...dto, email: dto.email?.toLowerCase() } });
    }

    async addSite(clientId: string, dto: SiteInputDto) {
        await this.ensureClient(clientId);
        const site = await this.prisma.site.create({ data: { clientId, label: dto.label, ...(await this.locate(dto)) } });
        await this.activity.log({ actor: 'USER', type: 'SITE_CREATED', message: `Site « ${site.label} » ajouté`, entityType: 'CLIENT', entityId: clientId });
        return site;
    }

    async updateSite(id: string, dto: UpdateSiteDto) {
        const site = await this.prisma.site.findUnique({ where: { id } });
        if (!site) throw new NotFoundException('Site introuvable');
        const addressChanged = dto.address !== undefined || dto.postalCode !== undefined || dto.city !== undefined;
        const location =
            addressChanged || (dto.lat !== undefined && dto.lng !== undefined)
                ? await this.locate({
                      address: dto.address ?? site.address,
                      postalCode: dto.postalCode ?? site.postalCode,
                      city: dto.city ?? site.city,
                      lat: dto.lat,
                      lng: dto.lng,
                  })
                : {};
        return this.prisma.site.update({ where: { id }, data: { label: dto.label, ...location } });
    }

    async addEquipment(siteId: string, dto: EquipmentInputDto) {
        const site = await this.prisma.site.findUnique({ where: { id: siteId } });
        if (!site) throw new NotFoundException('Site introuvable');
        return this.prisma.equipment.create({ data: { ...dto, siteId, installedAt: toDate(dto.installedAt) } });
    }

    async updateEquipment(id: string, dto: UpdateEquipmentDto) {
        await this.ensure(this.prisma.equipment.findUnique({ where: { id } }), 'Équipement introuvable');
        return this.prisma.equipment.update({ where: { id }, data: dto });
    }

    /** Suppression possible uniquement si l'équipement n'a aucun historique. */
    async deleteEquipment(id: string) {
        const equipment = await this.ensure(
            this.prisma.equipment.findUnique({ where: { id }, include: { _count: { select: { interventions: true, requests: true } } } }),
            'Équipement introuvable',
        );
        if (equipment._count.interventions || equipment._count.requests) {
            throw new ConflictException("Cet équipement a un historique d'interventions : il ne peut pas être supprimé");
        }
        await this.prisma.equipment.delete({ where: { id } });
        return { deleted: true };
    }

    async addContract(clientId: string, dto: ContractInputDto) {
        await this.ensureClient(clientId);
        if (new Date(dto.endDate) <= new Date(dto.startDate)) throw new BadRequestException('La fin du contrat doit suivre son début');
        try {
            const contract = await this.prisma.contract.create({
                data: {
                    ...dto,
                    clientId,
                    startDate: new Date(dto.startDate),
                    endDate: new Date(dto.endDate),
                    nextServiceDate: toDate(dto.nextServiceDate),
                },
            });
            await this.activity.log({ actor: 'USER', type: 'CONTRACT_CREATED', message: `Contrat ${contract.reference} ajouté`, entityType: 'CLIENT', entityId: clientId });
            return contract;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException(`La référence de contrat « ${dto.reference} » existe déjà`);
            }
            throw error;
        }
    }

    async updateContract(id: string, dto: UpdateContractDto) {
        await this.ensure(this.prisma.contract.findUnique({ where: { id } }), 'Contrat introuvable');
        return this.prisma.contract.update({
            where: { id },
            data: {
                ...dto,
                startDate: toDate(dto.startDate),
                endDate: toDate(dto.endDate),
                nextServiceDate: toDate(dto.nextServiceDate),
            },
        });
    }

    private async ensure<T>(promise: Promise<T | null>, message: string): Promise<T> {
        const value = await promise;
        if (!value) throw new NotFoundException(message);
        return value;
    }

    private ensureClient(id: string) {
        return this.ensure(this.prisma.client.findUnique({ where: { id } }), 'Client introuvable');
    }
}
