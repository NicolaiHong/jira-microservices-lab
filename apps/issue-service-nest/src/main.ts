import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { DomainExceptionFilter } from './presentation/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1024 * 1024 }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastify.addHook('onRequest', async (request, reply) => {
    const supplied = request.headers['x-correlation-id'];
    const correlationId =
      typeof supplied === 'string' && supplied.length > 0
        ? supplied
        : randomUUID();
    request.headers['x-correlation-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);
    (request as typeof request & { requestStartedAt?: number }).requestStartedAt =
      Date.now();
  });
  fastify.addHook('onResponse', async (request, reply) => {
    const startedAt = (
      request as typeof request & { requestStartedAt?: number }
    ).requestStartedAt;
    console.log(
      JSON.stringify({
        service: 'issue-service',
        correlationId: request.headers['x-correlation-id'],
        method: request.method,
        path: request.url,
        status: reply.statusCode,
        durationMs: startedAt ? Date.now() - startedAt : undefined,
      }),
    );
  });
  const port = Number(process.env.PORT ?? 8083);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
