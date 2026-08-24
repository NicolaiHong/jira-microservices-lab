import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

interface IamServiceResponse {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Injectable()
export class IamServiceAdapter {
  private readonly logger = new Logger(IamServiceAdapter.name);
  private readonly iamServiceUrl = (
    process.env.IAM_SERVICE_URL ?? 'http://localhost:8081'
  ).replace(/\/+$/, '');
  private readonly internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET ?? '';

  register(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('register', body, correlationId);
  }

  login(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('login', body, correlationId);
  }

  refresh(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('refresh', body, correlationId);
  }

  logout(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('logout', body, correlationId);
  }

  private async forwardToIam(
    path: 'register' | 'login' | 'refresh' | 'logout',
    body: unknown,
    correlationId: string,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutMs = Number(process.env.HTTP_CLIENT_TIMEOUT_MS ?? 3000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${this.iamServiceUrl}/auth/${path}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-correlation-id': correlationId,
          'x-internal-service-secret': this.internalServiceSecret,
        },
        body: JSON.stringify(body ?? {}),
      });
      const responseBody = await this.parseJsonResponse(response);

      this.logDownstream(path, correlationId, response.status, startedAt);

      if (!response.ok) {
        throw new AppException(
          response.status,
          this.stringOrDefault(responseBody.code, 'IAM_AUTH_ERROR'),
          this.stringOrDefault(responseBody.message, 'IAM auth request failed'),
          this.objectOrEmpty(responseBody.details),
        );
      }

      return responseBody;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      throw new AppException(
        503,
        'IAM_SERVICE_UNAVAILABLE',
        'IAM service is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private logDownstream(
    path: string,
    correlationId: string,
    status: number,
    startedAt: number,
  ): void {
    this.logger.log(
      JSON.stringify({
        service: 'api-gateway',
        correlationId,
        downstreamService: 'iam-service',
        downstreamPath: `/auth/${path}`,
        status,
        durationMs: Date.now() - startedAt,
      }),
    );
  }

  private async parseJsonResponse(
    response: Response,
  ): Promise<IamServiceResponse> {
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
