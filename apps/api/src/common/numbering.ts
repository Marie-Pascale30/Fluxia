import type { Tx } from '../prisma/prisma.service.js';
import { requireOrganizationId } from './tenant.js';

/**
 * Prochaine valeur d'un compteur, incrémentée atomiquement par la base en une
 * seule instruction (aucun doublon possible, même avec des créations simultanées).
 * `first` est la valeur attribuée lors de la toute première utilisation.
 * Chaque entreprise a ses propres compteurs (requête brute : filtrée ici, pas par l'extension).
 */
export async function nextValue(tx: Tx, key: string, first: number): Promise<number> {
    const organizationId = requireOrganizationId();
    const [row] = await tx.$queryRaw<{ value: number }[]>`
        INSERT INTO "Counter" ("organizationId", "key", "value") VALUES (${organizationId}, ${key}, ${first})
        ON CONFLICT ("organizationId", "key") DO UPDATE SET "value" = "Counter"."value" + 1
        RETURNING "value"`;
    return row.value;
}
