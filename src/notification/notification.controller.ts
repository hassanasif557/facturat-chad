import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification } from './notification.entity';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,

    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

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

  // =========================
  // 📢 BROADCAST API
  // =========================
  @Post('broadcast')
  async broadcast(@Body() body: any) {
    return this.notificationService.sendBroadcast(body);
  }

  @Get('my')
  async getUserNotifications(userId: number) {
    return this.notificationRepo
      .createQueryBuilder('n')
      .leftJoin('n.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('n.id', 'DESC')
      .getMany();
  }

  @Get('admin/history')
  async adminHistory(@Query() query: any) {
    const qb = this.notificationRepo.createQueryBuilder('n');

    if (query.status) {
      qb.andWhere('n.status = :status', { status: query.status });
    }

    if (query.type) {
      qb.andWhere('n.type = :type', { type: query.type });
    }

    if (query.userId) {
      qb.andWhere('n.userId = :userId', { userId: query.userId });
    }

    return qb.orderBy('n.id', 'DESC').getMany();
  }
}
