import { Body, Controller, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ==============================
  // 🧪 TEST PUSH (MANUAL)
  // ==============================
  @Post('test')
  async testPush(
    @Body()
    body: {
      token: string;
      title?: string;
      message?: string;
    },
  ) {
    if (!body.token) {
      return { error: 'Token is required' };
    }

    return this.notificationService.sendPush(
      body.token,
      body.title || 'Test Notification 🚀',
      body.message || 'This is a test push notification',
      {
        type: 'test',
      },
    );
  }

  // ==============================
  // 🧪 TEST WITH DATA PAYLOAD
  // ==============================
  @Post('test-data')
  async testPushWithData(
    @Body()
    body: {
      token: string;
    },
  ) {
    return this.notificationService.sendPush(
      body.token,
      'Invoice Notification 💰',
      'Invoice created successfully',
      {
        type: 'invoice',
        invoiceId: '123',
      },
    );
  }
}