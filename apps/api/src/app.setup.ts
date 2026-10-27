import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PrismaErrorsFilter } from './common/prisma-errors.filter.js';

/** Configuration commune à l'application réelle et aux tests e2e. */
export function configureApp(app: INestApplication) {
    app.setGlobalPrefix('api');
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
