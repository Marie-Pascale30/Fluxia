// Les pièces d'un rapport sont stockées dans une colonne JSON.
import type { ReportPart } from '../ai/ai.types.js';
import type { Prisma } from '../generated/prisma/client.js';

export function readParts(value: Prisma.JsonValue | null | undefined): ReportPart[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const { label, catalogCode, quantity } = item as Record<string, unknown>;
        if (typeof label !== 'string' || typeof quantity !== 'number') return [];
        return [{ label, quantity, catalogCode: typeof catalogCode === 'string' ? catalogCode : null }];
    });
}

export const partsJson = (parts: ReportPart[]): Prisma.InputJsonValue =>
    parts.map((p) => ({ label: p.label, catalogCode: p.catalogCode, quantity: p.quantity }));
