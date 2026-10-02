import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export interface ContractCoverage {
    active: boolean;
    reference: string | null;
    coversLabor: boolean;
    coversParts: boolean;
    coversTravel: boolean;
}

@Injectable()
export class ClientsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(search?: string) {
        const now = new Date();
        const clients = await this.prisma.client.findMany({
            orderBy: { name: 'asc' },
            include: {
                contracts: true,
                _count: { select: { sites: true, interventions: true } },
                sites: { select: { _count: { select: { equipments: true } } } },
                interventions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, number: true } },
            },
        });

        return clients
            .filter((c) => !search || normalize(c.name).includes(normalize(search)))
            .map(({ sites, contracts, interventions, _count, ...client }) => ({
                ...client,
                siteCount: _count.sites,
                interventionCount: _count.interventions,
                equipmentCount: sites.reduce((sum, s) => sum + s._count.equipments, 0),
                activeContract: contracts.some((ct) => ct.startDate <= now && ct.endDate >= now),
                lastIntervention: interventions[0] ?? null,
            }));
    }

    async findOne(id: string) {
        const client = await this.prisma.client.findUnique({
            where: { id },
            include: {
                sites: { include: { equipments: true } },
                contracts: { orderBy: { endDate: 'desc' } },
                interventions: {
                    orderBy: { createdAt: 'desc' },
                    include: { technician: true, equipment: true },
                },
                quotes: { orderBy: { createdAt: 'desc' }, include: { lines: true } },
            },
        });
        if (!client) throw new NotFoundException('Client introuvable');
        return client;
    }

    /** Couverture contractuelle en vigueur à une date donnée (détermine ce qui est facturable). */
    async coverage(clientId: string, at = new Date()): Promise<ContractCoverage> {
        const contract = await this.prisma.contract.findFirst({
            where: { clientId, startDate: { lte: at }, endDate: { gte: at } },
            orderBy: { endDate: 'desc' },
        });
        if (!contract) {
            return { active: false, reference: null, coversLabor: false, coversParts: false, coversTravel: false };
        }
        return {
            active: true,
            reference: contract.reference,
            coversLabor: contract.coversLabor,
            coversParts: contract.coversParts,
            coversTravel: contract.coversTravel,
        };
    }

    /**
     * Rattache un expéditeur à un client connu :
     * 1. email exact, 2. même domaine (hors webmails), 3. nom du client cité dans le texte.
     */
    async matchSender(fromEmail: string, text: string) {
        const clients = await this.prisma.client.findMany({ include: { sites: { include: { equipments: true } } } });
        const email = fromEmail.toLowerCase();
        const domain = email.split('@')[1];
        const webmails = ['gmail.com', 'yahoo.fr', 'hotmail.com', 'outlook.fr', 'outlook.com', 'orange.fr', 'free.fr', 'wanadoo.fr'];

        const byEmail = clients.find((c) => c.email?.toLowerCase() === email);
        if (byEmail) return { client: byEmail, method: 'email' as const };

        if (domain && !webmails.includes(domain)) {
            const byDomain = clients.find((c) => c.email?.toLowerCase().endsWith(`@${domain}`));
            if (byDomain) return { client: byDomain, method: 'domain' as const };
        }

        const haystack = normalize(text);
        const byName = clients
            .filter((c) => haystack.includes(normalize(c.name)))
            .sort((a, b) => b.name.length - a.name.length)[0];
        if (byName) return { client: byName, method: 'name' as const };

        return null;
    }
}
