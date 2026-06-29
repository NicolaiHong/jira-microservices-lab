import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';

const correlationIdSymbol = Symbol('correlationId');

interface CorrelatedRequest extends FastifyRequest {
  [correlationIdSymbol]?: string;
}

export function getCorrelationId(request: FastifyRequest): string {
  const correlatedRequest = request as CorrelatedRequest;
  if (correlatedRequest[correlationIdSymbol]) {
    return correlatedRequest[correlationIdSymbol];
  }

  const header = request.headers['x-correlation-id'];
  if (typeof header === 'string' && header.trim().length > 0) {
    correlatedRequest[correlationIdSymbol] = header;
    return header;
  }

  const generated = `req_${randomUUID().replace(/-/g, '')}`;
  correlatedRequest[correlationIdSymbol] = generated;
  return generated;
}
