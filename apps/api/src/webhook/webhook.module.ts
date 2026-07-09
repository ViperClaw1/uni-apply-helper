import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentsModule } from '../students/students.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [StudentsModule, NotificationsModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
