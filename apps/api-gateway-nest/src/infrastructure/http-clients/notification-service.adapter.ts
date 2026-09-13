import { Injectable } from '@nestjs/common';
import { InternalServiceHttpClient, RequestContext } from './internal-service-http.client';

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

  list(context: RequestContext): Promise<unknown> {
    return this.forward('GET', '/internal/notifications', context);
  }

  async markRead(notificationId: string, context: RequestContext): Promise<void> {
    await this.forward(
      'PATCH',
      `/internal/notifications/${encodeURIComponent(notificationId)}/read`,
      context,
    );
  }

  async markAllRead(context: RequestContext): Promise<void> {
    await this.forward('POST', '/internal/notifications/read-all', context);
  }

  private forward(method: 'GET' | 'PATCH' | 'POST', path: string, context: RequestContext): Promise<unknown> {
    return this.client.forward(method, path, undefined, context);
  }
}
