import { Injectable } from '@nestjs/common';
import { AppException } from '../../domain/errors/app.exception';
import type { IIamServicePort } from '../../domain/ports/iam-service.port';

interface IamServiceResponse {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Injectable()
export class IamServiceAdapter implements IIamServicePort {
  private readonly iamServiceUrl = (
    process.env.IAM_SERVICE_URL ?? 'http://localhost:8081'
  ).replace(/\/+$/, '');

  register(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('register', body, correlationId);
  }

  login(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('login', body, correlationId);
  }

  private async forwardToIam(
    path: 'register' | 'login',
    body: unknown,
    correlationId: string,
  ): Promise<unknown> {
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
    }
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
