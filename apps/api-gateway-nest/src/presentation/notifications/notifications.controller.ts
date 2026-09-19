import { Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { NotificationServiceAdapter } from '../../infrastructure/http-clients/notification-service.adapter';
import { getCorrelationId } from '../common/errors/correlation-id';
import type { AuthenticatedRequest } from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationServiceAdapter) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.notifications.list(this.context(request));
  }

  @Patch(':notificationId/read')
  @HttpCode(204)
  markRead(
    @Param('notificationId') notificationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.markRead(notificationId, this.context(request));
  }

  @Post('read-all')
  @HttpCode(204)
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllRead(this.context(request));
  }

  // JwtAuthGuard sets request.user before any handler runs.
  private context(request: AuthenticatedRequest) {
    return { userId: request.user!.id, correlationId: getCorrelationId(request) };
  }
}
