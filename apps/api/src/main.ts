import './env.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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

    const port = Number(process.env.PORT ?? 4000);
    await app.listen(port);
    console.log(`API Fluxia prête sur http://localhost:${port}/api`);
}
await bootstrap();
