import type { FastifyRequest } from 'fastify';

export interface GatewayUser {
  id: string;
  userId: string;
  email: string;
  roles: string[];
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: GatewayUser;
}
