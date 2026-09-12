import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

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
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  async getUserNotifications(@Req() req) {
    return this.notificationRepo
      .createQueryBuilder('n')
      .leftJoin('n.user', 'user')
      .where('user.id = :userId', { userId: req.user.sub })
      .orderBy('n.id', 'DESC')
      .getMany();
  }

  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  async listNotifications(@Req() req, @Query() query: any) {
    const page = Number(query.page || 1);
    const limit = Math.min(Number(query.limit || 20), 100);

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .leftJoin('n.user', 'user')
      .where('user.id = :userId', { userId: req.user.sub });

    if (String(query.unreadOnly) === 'true') {
      qb.andWhere('n.readAt is null');
    }

    const [data, total] = await qb
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: data.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.message,
        data: n.dataJson || {},
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  @Patch(':notificationId/read')
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  async markRead(@Req() req, @Param('notificationId') notificationId: number) {
    const notification = await this.notificationRepo.findOne({
      where: { id: Number(notificationId), user: { id: req.user.sub } },
      relations: ['user'],
    });
    if (!notification) return;
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }
  }

  @Post('read-all')
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  async markAllRead(@Req() req) {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where(`"userId" = :userId`, { userId: req.user.sub })
      .andWhere(`"readAt" is null`)
      .execute();
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
