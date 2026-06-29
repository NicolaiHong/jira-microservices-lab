export const RATE_LIMITER_PORT = 'IRateLimiterPort';

export interface RateLimitResult {
  limited: boolean;
  count: number;
  limit: number;
  ttlSeconds: number;
  failOpen: boolean;
}

export interface IRateLimiterPort {
  hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;

  isAtLimit(key: string, limit: number): Promise<boolean>;
}
