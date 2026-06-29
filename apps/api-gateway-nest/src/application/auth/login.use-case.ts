import { AppException } from '../../domain/errors/app.exception';
import type { IIamServicePort } from '../../domain/ports/iam-service.port';
import type {
  IRateLimiterPort,
  RateLimitResult,
} from '../../domain/ports/rate-limiter.port';

export interface LoginInput {
  body: unknown;
  clientIp: string;
  correlationId: string;
}

export class LoginUseCase {
  constructor(
    private readonly iamService: IIamServicePort,
    private readonly rateLimiter: IRateLimiterPort,
  ) {}

  async execute(input: LoginInput): Promise<unknown> {
    const ipLimit = await this.rateLimiter.hit(
      `rate:auth:login:ip:${input.clientIp}`,
      10,
      60,
    );

    if (ipLimit.limited) {
      throw this.rateLimited('login_ip', ipLimit);
    }

    const email = this.emailFromBody(input.body);
    const emailKey = email ? `rate:auth:login:email:${email}` : null;
    if (emailKey && (await this.rateLimiter.isAtLimit(emailKey, 5))) {
      throw this.rateLimited('login_email', {
        limited: true,
        count: 5,
        limit: 5,
        ttlSeconds: 300,
        failOpen: false,
      });
    }

    try {
      return await this.iamService.login(input.body, input.correlationId);
    } catch (error) {
      if (
        emailKey &&
        error instanceof AppException &&
        error.code === 'INVALID_CREDENTIALS'
      ) {
        await this.rateLimiter.hit(emailKey, 5, 300);
      }

      throw error;
    }
  }

  private rateLimited(rule: string, result: RateLimitResult): AppException {
    return new AppException(429, 'RATE_LIMITED', 'Too many requests', {
      rule,
      limit: result.limit,
      count: result.count,
      retryAfterSeconds: Math.max(result.ttlSeconds, 0),
    });
  }

  private emailFromBody(body: unknown): string | null {
    if (!this.isObject(body) || typeof body.email !== 'string') {
      return null;
    }

    const email = body.email.trim().toLowerCase();
    return email.length > 0 ? email : null;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
