import { AppException } from '../../domain/errors/app.exception';
import type { IIamServicePort } from '../../domain/ports/iam-service.port';
import type {
  IRateLimiterPort,
  RateLimitResult,
} from '../../domain/ports/rate-limiter.port';

export interface RegisterInput {
  body: unknown;
  clientIp: string;
  correlationId: string;
}

export class RegisterUseCase {
  constructor(
    private readonly iamService: IIamServicePort,
    private readonly rateLimiter: IRateLimiterPort,
  ) {}

  async execute(input: RegisterInput): Promise<unknown> {
    const rateLimit = await this.rateLimiter.hit(
      `rate:auth:register:ip:${input.clientIp}`,
      5,
      600,
    );

    if (rateLimit.limited) {
      throw this.rateLimited('register_ip', rateLimit);
    }

    return this.iamService.register(input.body, input.correlationId);
  }

  private rateLimited(rule: string, result: RateLimitResult): AppException {
    return new AppException(429, 'RATE_LIMITED', 'Too many requests', {
      rule,
      limit: result.limit,
      count: result.count,
      retryAfterSeconds: Math.max(result.ttlSeconds, 0),
    });
  }
}
