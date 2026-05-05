import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationTemplateModule } from 'src/notification-template/notification-template.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/user.entity';
import { Notification } from './notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Notification]),
    NotificationTemplateModule, // 🔥 REQUIRED
  ],
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService]
})
export class NotificationModule {}
