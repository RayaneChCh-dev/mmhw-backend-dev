import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { DatabaseModule } from '../database/database.module';

/**
 * Notifications Module
 * Provides push notifications via Expo, email notifications via Resend,
 * and real-time WebSocket updates
 */
@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, EmailService],
  exports: [NotificationsService, NotificationsGateway, EmailService], // Export for use in other modules
})
export class NotificationsModule {}
