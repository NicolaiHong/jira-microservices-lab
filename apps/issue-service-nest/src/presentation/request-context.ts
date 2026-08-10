import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors';

export function requestContext(request: FastifyRequest) {
  const userId = request.headers['x-authenticated-user-id'];
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new DomainError(
      401,
      'AUTH_CONTEXT_REQUIRED',
      'Authenticated user context is required',
    );
  }
  const correlation = request.headers['x-correlation-id'];
  return {
    userId,
    correlationId:
      typeof correlation === 'string' && correlation.length > 0
        ? correlation
        : randomUUID(),
  };
}
