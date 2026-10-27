import { ArgumentsHost, Catch, ConflictException, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Erreurs Prisma connues traduites en réponses HTTP : enregistrement introuvable (ou appartenant
 * à une autre entreprise, donc invisible) → 404 ; contrainte d'unicité → 409. Les autres restent des 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorsFilter extends BaseExceptionFilter {
    catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        if (error.code === 'P2025') return super.catch(new NotFoundException('Introuvable'), host);
        if (error.code === 'P2002') return super.catch(new ConflictException('Cette valeur est déjà utilisée'), host);
        return super.catch(error, host);
    }
}
