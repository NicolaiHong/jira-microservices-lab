import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';

export function getCorrelationId(request: FastifyRequest): string {
  const header = request.headers['x-correlation-id'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header;
  }

  return `req_${randomUUID().replace(/-/g, '')}`;
}
