import { Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from '../../services/notifications.service';
import { getCorrelationId } from '../common/errors/correlation-id';
import type { AuthenticatedRequest } from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.notifications.list(request.user?.userId, getCorrelationId(request));
  }

  @Patch(':notificationId/read')
  @HttpCode(204)
  markRead(
    @Param('notificationId') notificationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.markRead(notificationId, request.user?.userId, getCorrelationId(request));
  }

  @Post('read-all')
  @HttpCode(204)
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllRead(request.user?.userId, getCorrelationId(request));
  }
}
