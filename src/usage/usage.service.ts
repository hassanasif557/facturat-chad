import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Usage } from './usage.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Plan } from 'src/plan/plan.entity';
import { Subscription } from 'src/subscription/subscription.entity';
import { User } from 'src/user/user.entity';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationEvent } from 'src/notification/notification-event.enum';

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(Usage)
    private usageRepo: Repository<Usage>,

    private notificationService: NotificationService,
  ) {}

  // 📅 current month key
  getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}`;
  }

  // 🔍 find or create usage
  async getOrCreateUsage(userId?: number, orgId?: number) {
    const month = this.getCurrentMonth();

    let usage = await this.usageRepo.findOne({
      where: {
        month,
        user: userId ? { id: userId } : undefined,
        organization: orgId ? { id: orgId } : undefined,
      },
    });

    if (!usage) {
      usage = this.usageRepo.create({
        month,
        invoiceCount: 0,
        user: userId ? ({ id: userId } as any) : null,
        organization: orgId ? ({ id: orgId } as any) : null,
      });

      usage = await this.usageRepo.save(usage);
    }

    return usage;
  }

  // ➕ increment usage
  async increment(userId?: number, orgId?: number) {
  const usage = await this.getOrCreateUsage(userId, orgId);
  usage.invoiceCount += 1;

  await this.usageRepo.save(usage);

  await this.notificationService.sendEventToUsers(
    NotificationEvent.USAGE_INCREMENTED,
    {
      userId,
      orgId,
    },
    {
      count: usage.invoiceCount.toString(),
    },
  );

  return usage;
}

  async resetUsage(userId?: number, orgId?: number) {
  const month = this.getCurrentMonth();

  const usage = await this.usageRepo.findOne({
    where: {
      month,
      user: userId ? { id: userId } : undefined,
      organization: orgId ? { id: orgId } : undefined,
    },
  });

  if (!usage) return { message: 'No usage found' };

  usage.invoiceCount = 0;

  await this.usageRepo.save(usage);

  await this.notificationService.sendEventToUsers(
    NotificationEvent.USAGE_RESET,
    {
      userId,
      orgId,
    },
    {
      month,
    },
  );

  return usage;
}

  async getMyUsage(user: any) {
    const userEntity = await this.usageRepo.manager.findOne(User, {
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!userEntity) {
      throw new NotFoundException('User not found');
    }

    const month = this.getCurrentMonth();

    // 🔍 get usage
    const usage = await this.usageRepo.findOne({
      where: {
        month,
        user: userEntity.organization ? undefined : { id: user.sub },
        organization: userEntity.organization
          ? { id: userEntity.organization.id }
          : undefined,
      },
    });

    // 🔍 get subscription
    const sub = await this.usageRepo.manager.findOne(Subscription, {
      where: userEntity.organization
        ? {
            organization: { id: userEntity.organization.id },
            isActive: true,
          }
        : {
            user: { id: user.sub },
            isActive: true,
          },
      relations: ['plan'],
    });

    if (!sub) {
      return {
        used: 0,
        limit: 0,
        remaining: 0,
      };
    }

    const plan = sub.plan;

    const used = usage?.invoiceCount || 0;

    return {
      used,
      limit: plan.invoiceLimit === -1 ? 'unlimited' : plan.invoiceLimit,
      remaining:
        plan.invoiceLimit === -1
          ? 'unlimited'
          : Math.max(plan.invoiceLimit - used, 0),
      plan: plan.name,
    };
  }

  async resetForAdmin(user: any) {
    const userEntity = await this.usageRepo.manager.findOne(User, {
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!userEntity) {
      throw new NotFoundException('User not found');
    }

    return this.resetUsage(
      userEntity.organization ? undefined : user.sub,
      userEntity.organization?.id,
    );
  }

  async resetUserUsage(userId: number) {
  const usage = await this.usageRepo.findOne({
    where: {
      user: { id: userId },
      month: this.getCurrentMonth(),
    },
  });

  if (!usage) {
    const newUsage = this.usageRepo.create({
      user: { id: userId } as any,
      month: this.getCurrentMonth(),
      invoiceCount: 0,
    });

    await this.usageRepo.save(newUsage);
  } else {
    usage.invoiceCount = 0;
    await this.usageRepo.save(usage);
  }

  await this.notificationService.sendEventToUsers(
    NotificationEvent.USAGE_RESET,
    { userId },
    {
      type: 'user',
    },
  );

  return { message: 'User usage reset' };
}

  async resetOrgUsage(orgId: number) {
  const usage = await this.usageRepo.findOne({
    where: {
      organization: { id: orgId },
      month: this.getCurrentMonth(),
    },
  });

  if (!usage) {
    const newUsage = this.usageRepo.create({
      organization: { id: orgId } as any,
      month: this.getCurrentMonth(),
      invoiceCount: 0,
    });

    await this.usageRepo.save(newUsage);
  } else {
    usage.invoiceCount = 0;
    await this.usageRepo.save(usage);
  }

  await this.notificationService.sendEventToUsers(
    NotificationEvent.USAGE_RESET,
    { orgId },
    {
      type: 'organization',
    },
  );

  return { message: 'Org usage reset' };
}

  async resetAllUsage() {
    const month = this.getCurrentMonth();

    await this.usageRepo.update({ month }, { invoiceCount: 0 });

    return { message: 'All usage reset successfully' };
  }
}
