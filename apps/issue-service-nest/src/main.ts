import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { DomainExceptionFilter } from './presentation/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (!internalServiceSecret) {
    throw new Error('INTERNAL_SERVICE_SECRET is required');
  }
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1024 * 1024 }),
  );
  app.getHttpAdapter().getInstance().addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/health')) return;
    const supplied = request.headers['x-internal-service-secret'];
    const suppliedBuffer = Buffer.from(
      typeof supplied === 'string' ? supplied : '',
      'utf8',
    );
    const expectedBuffer = Buffer.from(internalServiceSecret, 'utf8');
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      reply.code(401).send({
        code: 'INTERNAL_SERVICE_AUTH_REQUIRED',
        message: 'Valid internal service credentials are required',
        details: {},
      });
    }
  });
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
