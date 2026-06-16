import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins });

  app.setGlobalPrefix('api');

  const port = Number(process.env.API_PORT ?? 3333);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`GeoMatrícula API ouvindo em http://localhost:${port}/api`);
}

bootstrap();
