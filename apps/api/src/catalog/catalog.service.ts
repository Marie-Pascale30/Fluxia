import { Injectable } from '@nestjs/common';
import type { QuoteLineKind } from '../common/domain.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CatalogEntry } from '../ai/ai.types.js';

@Injectable()
export class CatalogService {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.catalogItem.findMany({ orderBy: [{ kind: 'asc' }, { label: 'asc' }] });
    }

    /** Format transmis à l'IA (sans les prix : ils sont appliqués côté serveur). */
    async forAi(): Promise<CatalogEntry[]> {
        const items = await this.findAll();
        return items.map((i) => ({
            code: i.code,
            label: i.label,
            kind: i.kind as QuoteLineKind,
            keywords: i.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        }));
    }

    async priceMap(): Promise<Map<string, { label: string; kind: string; unitPriceCents: number }>> {
        const items = await this.findAll();
        return new Map(items.map((i) => [i.code, i]));
    }
}
