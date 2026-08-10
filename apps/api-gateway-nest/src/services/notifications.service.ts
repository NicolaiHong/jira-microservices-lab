import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { NotificationServiceAdapter } from '../infrastructure/http-clients/notification-service.adapter';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationClient: NotificationServiceAdapter) {}

  list(userId: string | undefined, correlationId: string) {
    return this.notificationClient.list(this.context(userId, correlationId));
  }
  markRead(notificationId: string, userId: string | undefined, correlationId: string) {
    return this.notificationClient.markRead(notificationId, this.context(userId, correlationId));
  }
  markAllRead(userId: string | undefined, correlationId: string) {
    return this.notificationClient.markAllRead(this.context(userId, correlationId));
  }

  private context(userId: string | undefined, correlationId: string) {
    if (!userId) throw new AppException(401, 'UNAUTHORIZED', 'Authentication token is required');
    return { userId, correlationId };
  }
}
