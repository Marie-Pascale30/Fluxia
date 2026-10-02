import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** Client Prisma sans moteur natif : la connexion passe par le pilote PostgreSQL `pg`. */
export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error('DATABASE_URL manquant');
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL manquant');
        super({ adapter: new PrismaPg({ connectionString }) });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}

/** Client transactionnel (utilisable à la place de PrismaService dans $transaction). */
export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
