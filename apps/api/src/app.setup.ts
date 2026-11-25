import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import helmet from 'helmet';
import { PrismaErrorsFilter } from './common/prisma-errors.filter.js';

/** Configuration commune à l'application réelle et aux tests e2e. */
export function configureApp(app: INestApplication) {
    app.setGlobalPrefix('api');
    // En-têtes de sécurité (l'API ne sert que du JSON, des PDF et des fichiers : politique stricte).
    // helmet retire aussi X-Powered-By ; on le désactive en plus au niveau d'Express.
    app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
    (app.getHttpAdapter().getInstance() as { disable?: (setting: string) => void }).disable?.('x-powered-by');
    app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );
    app.useGlobalFilters(new PrismaErrorsFilter(app.get(HttpAdapterHost).httpAdapter));
    app.enableShutdownHooks();
    return app;
}
