import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type {
  IRateLimiterPort,
  RateLimitResult,
} from '../../domain/ports/rate-limiter.port';

@Injectable()
export class RedisRateLimitAdapter
  implements IRateLimiterPort, OnModuleDestroy
{
  private readonly redis: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 500,
    });
    this.redis.on('error', (error) => {
      console.warn(`Redis rate limit unavailable: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }

  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    try {
      await this.ensureConnected();
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      let ttlSeconds = await this.redis.ttl(key);
      if (ttlSeconds < 0) {
        await this.redis.expire(key, windowSeconds);
        ttlSeconds = windowSeconds;
      }

      return {
        limited: count > limit,
        count,
        limit,
        ttlSeconds,
        failOpen: false,
      };
    } catch (error) {
      this.warnFailOpen(error);
      return {
        limited: false,
        count: 0,
        limit,
        ttlSeconds: 0,
        failOpen: true,
      };
    }
  }

  async isAtLimit(key: string, limit: number): Promise<boolean> {
    try {
      await this.ensureConnected();
      const rawCount = await this.redis.get(key);
      return Number(rawCount ?? 0) >= limit;
    } catch (error) {
      this.warnFailOpen(error);
      return false;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }

  private warnFailOpen(error: unknown): void {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`Redis rate limit fail-open: ${message}`);
  }
}
