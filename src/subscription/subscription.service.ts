import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { Repository, DeepPartial, MoreThan } from 'typeorm';
import { Plan } from 'src/plan/plan.entity';
import { User } from 'src/user/user.entity';
import { Organization } from 'src/organization/organization.entity';
import { Invoice } from 'src/invoice/invoice.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,

    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {}

  // ✅ SUBSCRIBE
  async subscribe(user: any, planId: number) {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
    });

    if (!plan) throw new NotFoundException('Plan not found');

    const userEntity = await this.userRepo.findOne({
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!userEntity) throw new NotFoundException('User not found');

    let org = userEntity.organization;

    // TEAM PLAN CHECK
    if (plan.isTeamPlan) {
      if (!org) {
        throw new BadRequestException('Create organization first');
      }

      if (userEntity.orgRole !== 'owner') {
        throw new BadRequestException('Only owner can subscribe');
      }
    }

    // =========================
    // 🟡 CREATE PENDING REQUEST
    // =========================
    const subData: DeepPartial<Subscription> = {
      user: org ? null : userEntity,
      organization: org ? org : null,
      plan,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      isActive: true,
      status: SubscriptionStatus.PENDING,
    };

    const sub = this.subRepo.create(subData);

    const saved = await this.subRepo.save(sub);

    return this.subRepo.findOne({
      where: { id: saved.id },
      relations: ['user', 'organization', 'plan'],
    });
  }

  async getActiveSubscription(user: any) {
    const userEntity = await this.userRepo.findOne({
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!userEntity) throw new NotFoundException('User not found');

    const where = userEntity.organization
      ? {
          organization: { id: userEntity.organization.id },
          isActive: true,
        }
      : {
          user: { id: user.sub },
          isActive: true,
        };

    return this.subRepo.findOne({
      where,
      relations: ['plan', 'user', 'organization'],
    });
  }

  async approveSubscription(id: number) {
    const sub = await this.subRepo.findOne({
      where: { id },
      relations: ['user', 'organization', 'plan'],
    });

    if (!sub) throw new NotFoundException('Subscription not found');

    if (sub.status !== 'pending') {
      throw new BadRequestException('Already processed');
    }

    // ❌ deactivate previous subscriptions
    if (sub.user) {
      await this.subRepo.update(
        { user: { id: sub.user.id }, isActive: true },
        { isActive: false },
      );
    }

    if (sub.organization) {
      await this.subRepo.update(
        { organization: { id: sub.organization.id }, isActive: true },
        { isActive: false },
      );
    }

    // ✅ activate new
    sub.status = SubscriptionStatus.ACTIVE;
    sub.isActive = true;
    sub.startDate = new Date();
    sub.endDate = new Date(new Date().setMonth(new Date().getMonth() + 1));

    return this.subRepo.save(sub);
  }

  async rejectSubscription(id: number) {
    const sub = await this.subRepo.findOne({
      where: { id },
    });

    if (!sub) throw new NotFoundException('Subscription not found');

    sub.status = SubscriptionStatus.REJECTED;
    sub.isActive = false;

    return this.subRepo.save(sub);
  }

  async getPendingRequests() {
    return this.subRepo.find({
      where: { status: SubscriptionStatus.PENDING },
      relations: ['user', 'organization', 'plan'],
      order: { id: 'DESC' },
    });
  }

  async checkUserLimit(user: any) {
    const userEntity = await this.userRepo.findOne({
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!userEntity) throw new NotFoundException('User not found');

    if (!userEntity.organization) return; // solo plan

    const subscription = await this.getActiveSubscription(user);

    if (!subscription) {
      throw new ForbiddenException('No active subscription');
    }

    const plan = subscription.plan;

    // ♾️ unlimited users
    if (plan.userLimit === -1) return;

    const count = await this.userRepo.count({
      where: {
        organization: { id: userEntity.organization.id },
      },
    });

    if (count >= plan.userLimit) {
      throw new ForbiddenException(
        `User limit reached (${plan.userLimit}). Upgrade your plan.`,
      );
    }
  }

  // async getUsage(user: any) {
  //   const userEntity = await this.userRepo.findOne({
  //     where: { id: user.sub },
  //     relations: ['organization'],
  //   });

  //   if (!userEntity) {
  //     throw new NotFoundException('User not found');
  //   }

  //   // 🔹 get active subscription
  //   const subscription = await this.getActiveSubscription(user);

  //   if (!subscription) {
  //     throw new NotFoundException('No active subscription');
  //   }

  //   const plan = subscription.plan;

  //   // 🔹 count invoices (monthly)
  //   const startOfMonth = new Date();
  //   startOfMonth.setDate(1);
  //   startOfMonth.setHours(0, 0, 0, 0);

  //   let count = 0;

  //   if (userEntity.organization) {
  //     count = await this.invoiceRepo.count({
  //       where: {
  //         organization: { id: userEntity.organization.id },
  //         createdAt: MoreThan(startOfMonth),
  //       },
  //     });
  //   } else {
  //     count = await this.invoiceRepo.count({
  //       where: {
  //         user: { id: user.sub },
  //         createdAt: MoreThan(startOfMonth),
  //       },
  //     });
  //   }

  //   return {
  //     used: count,
  //     limit: plan.invoiceLimit === -1 ? 'unlimited' : plan.invoiceLimit,
  //     remaining:
  //       plan.invoiceLimit === -1
  //         ? 'unlimited'
  //         : Math.max(plan.invoiceLimit - count, 0),
  //   };
  // }
}
