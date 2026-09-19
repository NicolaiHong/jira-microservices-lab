import { Module } from '@nestjs/common';
import { NotificationServiceAdapter } from '../../infrastructure/http-clients/notification-service.adapter';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationServiceAdapter],
})
export class NotificationsModule {}
