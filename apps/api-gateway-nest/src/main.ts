import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './presentation/common/filters/api-exception.filter';
import { configureHttpObservability } from './presentation/common/logging/http-observability';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1024 * 1024 }),
  );
  const port = Number(process.env.PORT ?? 3000);
  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
  });
  configureHttpObservability(app);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
