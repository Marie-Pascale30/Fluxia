import { ValidationPipe, type INestApplication } from '@nestjs/common';

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
    app.enableShutdownHooks();
    return app;
}
