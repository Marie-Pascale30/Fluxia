import './env.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
    const app = configureApp(await NestFactory.create(AppModule));
    const port = Number(process.env.PORT ?? 4000);
    await app.listen(port);
    console.log(`API Fluxia prête sur http://localhost:${port}/api`);
}
await bootstrap();
