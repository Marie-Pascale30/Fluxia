import type { Tx } from '../prisma/prisma.service.js';

/**
 * Prochaine valeur d'un compteur, incrémentée atomiquement par la base en une
 * seule instruction (aucun doublon possible, même avec des créations simultanées).
 * `first` est la valeur attribuée lors de la toute première utilisation.
 */
export async function nextValue(tx: Tx, key: string, first: number): Promise<number> {
    const [row] = await tx.$queryRaw<{ value: number }[]>`
        INSERT INTO "Counter" ("key", "value") VALUES (${key}, ${first})
        ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
        RETURNING "value"`;
    return row.value;
}
