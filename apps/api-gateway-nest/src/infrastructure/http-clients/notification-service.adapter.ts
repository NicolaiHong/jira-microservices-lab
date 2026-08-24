import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

interface ProjectServiceRequestContext {
  userId: string;
  correlationId: string;
}

@Injectable()
export class NotificationServiceAdapter {
  private readonly logger = new Logger(NotificationServiceAdapter.name);
  private readonly baseUrl = (
    process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:8084'
  ).replace(/\/+$/, '');
  private readonly internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET ?? '';

  list(context: ProjectServiceRequestContext): Promise<unknown> {
    return this.forward('GET', '/internal/notifications', context);
  }

  async markRead(notificationId: string, context: ProjectServiceRequestContext): Promise<void> {
    await this.forward(
      'PATCH',
      `/internal/notifications/${encodeURIComponent(notificationId)}/read`,
      context,
    );
  }

  async markAllRead(context: ProjectServiceRequestContext): Promise<void> {
    await this.forward('POST', '/internal/notifications/read-all', context);
  }

  private async forward(
    method: 'GET' | 'PATCH' | 'POST',
    path: string,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.HTTP_CLIENT_TIMEOUT_MS ?? 3000),
    );
    const startedAt = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'x-authenticated-user-id': context.userId,
          'x-correlation-id': context.correlationId,
          'x-internal-service-secret': this.internalServiceSecret,
        },
      });
      const text = await response.text();
      const body = this.parse(text);
      this.logger.log(
        JSON.stringify({
          service: 'api-gateway',
          correlationId: context.correlationId,
          downstreamService: 'notification-service',
          downstreamPath: path,
          status: response.status,
          durationMs: Date.now() - startedAt,
        }),
      );
      if (!response.ok) {
        const error = this.object(body);
        throw new AppException(
          response.status,
          typeof error.code === 'string' ? error.code : 'NOTIFICATION_REQUEST_FAILED',
          typeof error.message === 'string'
            ? error.message
            : 'Notification service request failed',
          this.object(error.details),
        );
      }
      return body;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(
        503,
        'NOTIFICATION_SERVICE_UNAVAILABLE',
        'Notification service is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parse(text: string): unknown {
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
