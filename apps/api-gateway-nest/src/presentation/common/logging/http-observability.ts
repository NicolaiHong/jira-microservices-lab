import { Logger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getCorrelationId } from '../errors/correlation-id';

const requestStartedAt = new WeakMap<FastifyRequest, number>();
const logger = new Logger('HttpRequest');

export function configureHttpObservability(
  app: NestFastifyApplication,
): void {
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;

  fastify.addHook('onRequest', (request, reply, done) => {
    const correlationId = getCorrelationId(request);
    requestStartedAt.set(request, Date.now());
    reply.header('x-correlation-id', correlationId);
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const startedAt = requestStartedAt.get(request) ?? Date.now();
    logger.log(
      JSON.stringify({
        service: 'api-gateway',
        correlationId: getCorrelationId(request),
        method: request.method,
        path: request.url,
        status: reply.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
    requestStartedAt.delete(request);
    done();
  });
}
