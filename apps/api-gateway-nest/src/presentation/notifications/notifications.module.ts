import { Module } from '@nestjs/common';
import { NotificationServiceAdapter } from '../../infrastructure/http-clients/notification-service.adapter';
import { NotificationsService } from '../../services/notifications.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationServiceAdapter,
    NotificationsService,
  ],
})
export class NotificationsModule {}
