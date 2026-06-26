import { Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../common/errors/api.exception';
import { getCorrelationId } from '../common/errors/correlation-id';
import {
  RateLimitResult,
  RateLimitService,
} from '../common/rate-limit/rate-limit.service';

interface IamErrorResponse {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Injectable()
export class AuthService {
  private readonly iamServiceUrl = (
    process.env.IAM_SERVICE_URL ?? 'http://localhost:8081'
  ).replace(/\/+$/, '');

  constructor(private readonly rateLimitService: RateLimitService) {}

  async register(body: unknown, request: FastifyRequest): Promise<unknown> {
    const ip = this.clientIp(request);
    const rateLimit = await this.rateLimitService.hit(
      `rate:auth:register:ip:${ip}`,
      5,
      600,
    );

    if (rateLimit.limited) {
      throw this.rateLimited('register_ip', rateLimit);
    }

    return this.forwardToIam('register', body, request);
  }

  async login(body: unknown, request: FastifyRequest): Promise<unknown> {
    const ip = this.clientIp(request);
    const ipLimit = await this.rateLimitService.hit(
      `rate:auth:login:ip:${ip}`,
      10,
      60,
    );

    if (ipLimit.limited) {
      throw this.rateLimited('login_ip', ipLimit);
    }

    const email = this.emailFromBody(body);
    const emailKey = email ? `rate:auth:login:email:${email}` : null;
    if (emailKey && (await this.rateLimitService.isAtLimit(emailKey, 5))) {
      throw this.rateLimited('login_email', {
        limited: true,
        count: 5,
        limit: 5,
        ttlSeconds: 300,
        failOpen: false,
      });
    }

    try {
      return await this.forwardToIam('login', body, request);
    } catch (error) {
      if (
        emailKey &&
        error instanceof ApiException &&
        error.code === 'INVALID_CREDENTIALS'
      ) {
        await this.rateLimitService.hit(emailKey, 5, 300);
      }

      throw error;
    }
  }

  private async forwardToIam(
    path: 'register' | 'login',
    body: unknown,
    request: FastifyRequest,
  ): Promise<unknown> {
    const correlationId = getCorrelationId(request);

    try {
      const response = await fetch(`${this.iamServiceUrl}/auth/${path}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify(body ?? {}),
      });
      const responseBody = await this.parseJsonResponse(response);

      if (!response.ok) {
        throw new ApiException(
          response.status,
          this.stringOrDefault(responseBody.code, 'IAM_AUTH_ERROR'),
          this.stringOrDefault(responseBody.message, 'IAM auth request failed'),
          this.objectOrEmpty(responseBody.details),
        );
      }

      return responseBody;
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw new ApiException(
        503,
        'IAM_SERVICE_UNAVAILABLE',
        'IAM service is unavailable',
      );
    }
  }

  private async parseJsonResponse(response: Response): Promise<IamErrorResponse> {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(text);
      return this.isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private rateLimited(rule: string, result: RateLimitResult): ApiException {
    return new ApiException(429, 'RATE_LIMITED', 'Too many requests', {
      rule,
      limit: result.limit,
      count: result.count,
      retryAfterSeconds: Math.max(result.ttlSeconds, 0),
    });
  }

  private clientIp(request: FastifyRequest): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    return request.ip ?? 'unknown';
  }

  private emailFromBody(body: unknown): string | null {
    if (!this.isObject(body) || typeof body.email !== 'string') {
      return null;
    }

    const email = body.email.trim().toLowerCase();
    return email.length > 0 ? email : null;
  }

  private stringOrDefault(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }

  private objectOrEmpty(value: unknown): Record<string, unknown> {
    return this.isObject(value) ? value : {};
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
