import { Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

interface ClientOptions {
  service: string;
  baseUrl: string;
  requestErrorCode: string;
  requestErrorMessage: string;
  unavailableCode: string;
  unavailableMessage: string;
  objectResponseOnly?: boolean;
  nonemptyErrorStrings?: boolean;
  sendJsonBody?: boolean;
}

export class InternalServiceHttpClient {
  private readonly logger = new Logger(InternalServiceHttpClient.name);
  private readonly internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET ?? '';
  private readonly baseUrl: string;

  constructor(private readonly options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  async forward(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    context: { correlationId: string; userId?: string },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.HTTP_CLIENT_TIMEOUT_MS ?? 3000));
    const startedAt = Date.now();
    const hasBody = this.options.sendJsonBody !== false && (method === 'POST' || method === 'PATCH');
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...(context.userId ? { 'x-authenticated-user-id': context.userId } : {}),
          'x-correlation-id': context.correlationId,
          'x-internal-service-secret': this.internalServiceSecret,
        },
        body: hasBody ? JSON.stringify(body ?? {}) : undefined,
      });
      const text = await response.text();
      let parsed: unknown = {};
      try { parsed = text ? JSON.parse(text) : {}; } catch { /* Preserve existing empty-response fallback. */ }
      if (this.options.objectResponseOnly) parsed = this.object(parsed);
      this.logger.log(JSON.stringify({
        service: 'api-gateway', correlationId: context.correlationId,
        downstreamService: this.options.service, downstreamPath: path,
        status: response.status, durationMs: Date.now() - startedAt,
      }));
      if (!response.ok) {
        const error = this.object(parsed);
        throw new AppException(response.status,
          this.errorString(error.code, this.options.requestErrorCode),
          this.errorString(error.message, this.options.requestErrorMessage),
          this.object(error.details));
      }
      return parsed;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(503, this.options.unavailableCode, this.options.unavailableMessage);
    } finally {
      clearTimeout(timeout);
    }
  }

  private errorString(value: unknown, fallback: string): string {
    return typeof value === 'string' && (!this.options.nonemptyErrorStrings || value.length > 0) ? value : fallback;
  }

  private object(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
