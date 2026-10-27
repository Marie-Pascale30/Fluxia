import { Global, Module } from '@nestjs/common';
import { createPrismaClient, PrismaLifecycle, PrismaService } from './prisma.service.js';

@Global()
@Module({
    providers: [{ provide: PrismaService, useFactory: () => createPrismaClient() }, PrismaLifecycle],
    exports: [PrismaService],
})
export class PrismaModule {}
