import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { IamServiceAdapter } from '../infrastructure/http-clients/iam-service.adapter';
import { RedisRateLimitAdapter } from '../infrastructure/rate-limit/redis-rate-limit.adapter';

@Injectable()
export class AuthService {
  constructor(
    private readonly iamClient: IamServiceAdapter,
    private readonly rateLimiter: RedisRateLimitAdapter,
  ) {}

  async register(body: unknown, clientIp: string, correlationId: string) {
    const result = await this.rateLimiter.hit(
      `rate:auth:register:ip:${clientIp}`,
      5,
      600,
    );
    if (result.limited) throw this.rateLimited('register_ip', result);
    return this.iamClient.register(body, correlationId);
  }

  async login(body: unknown, clientIp: string, correlationId: string) {
    const ipLimit = await this.rateLimiter.hit(
      `rate:auth:login:ip:${clientIp}`,
      10,
      60,
    );
    if (ipLimit.limited) throw this.rateLimited('login_ip', ipLimit);

    const email = this.emailFromBody(body);
    const emailKey = email ? `rate:auth:login:email:${email}` : null;
    if (emailKey && (await this.rateLimiter.isAtLimit(emailKey, 5))) {
      throw this.rateLimited('login_email', {
        count: 5, limit: 5, ttlSeconds: 300,
      });
    }

    try {
      return await this.iamClient.login(body, correlationId);
    } catch (error) {
      if (emailKey && error instanceof AppException && error.code === 'INVALID_CREDENTIALS') {
        await this.rateLimiter.hit(emailKey, 5, 300);
      }
      throw error;
    }
  }

  refresh(body: unknown, correlationId: string) {
    return this.iamClient.refresh(body, correlationId);
  }

  logout(body: unknown, correlationId: string) {
    return this.iamClient.logout(body, correlationId);
  }

  private rateLimited(
    rule: string,
    result: { limit: number; count: number; ttlSeconds: number },
  ): AppException {
    return new AppException(429, 'RATE_LIMITED', 'Too many requests', {
      rule,
      limit: result.limit,
      count: result.count,
      retryAfterSeconds: Math.max(result.ttlSeconds, 0),
    });
  }

  private emailFromBody(body: unknown): string | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const email = (body as Record<string, unknown>).email;
    return typeof email === 'string' && email.trim()
      ? email.trim().toLowerCase()
      : null;
  }
}
