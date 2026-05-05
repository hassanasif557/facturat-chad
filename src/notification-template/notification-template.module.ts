import { Module } from '@nestjs/common';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationTemplateController } from './notification-template.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationTemplate } from './notification-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationTemplate]), // ✅ THIS LINE IS CRITICAL
  ],
  providers: [NotificationTemplateService],
  controllers: [NotificationTemplateController],
  exports: [NotificationTemplateService],
})
export class NotificationTemplateModule {}
