// create-notification-template.dto.ts
import { IsEnum, IsString, IsBoolean } from 'class-validator';
import { NotificationEvent } from '../notification/notification-event.enum';

export class CreateNotificationTemplateDto {
  @IsEnum(NotificationEvent)
  event!: NotificationEvent;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsBoolean()
  isEnabled!: boolean;
}