import { Injectable } from '@nestjs/common';
import { InternalServiceHttpClient } from './internal-service-http.client';

interface ProjectServiceRequestContext {
  userId: string;
  correlationId: string;
}

@Injectable()
export class NotificationServiceAdapter {
  private readonly client = new InternalServiceHttpClient({
    service: 'notification-service',
    baseUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:8084',
    requestErrorCode: 'NOTIFICATION_REQUEST_FAILED',
    requestErrorMessage: 'Notification service request failed',
    unavailableCode: 'NOTIFICATION_SERVICE_UNAVAILABLE',
    unavailableMessage: 'Notification service is unavailable',
    sendJsonBody: false,
  });

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

  private forward(method: 'GET' | 'PATCH' | 'POST', path: string, context: ProjectServiceRequestContext): Promise<unknown> {
    return this.client.forward(method, path, undefined, context);
  }
}
