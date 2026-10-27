import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { tenantExtension } from '../common/tenant.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Client Prisma sans moteur natif (connexion via le pilote PostgreSQL `pg`),
 * cloisonné par entreprise : voir common/tenant.ts.
 */
export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error('DATABASE_URL manquant');
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) }).$extends(tenantExtension);
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * Jeton d'injection du client Prisma (fourni par PrismaModule, useFactory).
 * La fusion classe + interface donne au jeton le type du client étendu : la classe
 * n'est jamais instanciée, la valeur injectée est bien le client créé par createPrismaClient().
 */
// oxlint-disable-next-line no-unsafe-declaration-merging
export abstract class PrismaService {}
// oxlint-disable-next-line no-unsafe-declaration-merging
export interface PrismaService extends AppPrismaClient {}

/** Ferme la connexion à l'arrêt de l'application. */
@Injectable()
export class PrismaLifecycle implements OnModuleDestroy {
    constructor(private readonly prisma: PrismaService) {}

    async onModuleDestroy() {
        await this.prisma.$disconnect();
    }
}

/** Client transactionnel (utilisable à la place de PrismaService dans $transaction). */
export type Tx = Omit<AppPrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
