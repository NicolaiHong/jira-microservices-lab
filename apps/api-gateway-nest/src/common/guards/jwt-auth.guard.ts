import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import jwt, { JwtPayload, TokenExpiredError } from 'jsonwebtoken';
import { ApiException } from '../errors/api.exception';
import { AuthenticatedRequest, GatewayUser } from './authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret =
    process.env.JWT_SECRET ?? 'local-week2-jwt-secret-change-me-32-bytes-minimum';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new ApiException(
        401,
        'UNAUTHORIZED',
        'Authentication token is required',
      );
    }

    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      request.user = this.toGatewayUser(payload);
      return true;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new ApiException(401, 'TOKEN_EXPIRED', 'Access token has expired');
      }

      throw new ApiException(401, 'INVALID_TOKEN', 'Access token is invalid');
    }
  }

  private extractBearerToken(authorization: unknown): string | null {
    if (typeof authorization !== 'string') {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private toGatewayUser(payload: JwtPayload): GatewayUser {
    const roles = payload.roles;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      !Array.isArray(roles) ||
      !roles.every((role) => typeof role === 'string')
    ) {
      throw new ApiException(401, 'INVALID_TOKEN', 'Access token is invalid');
    }

    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      roles,
    };
  }
}
