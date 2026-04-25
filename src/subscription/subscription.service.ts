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

  async getAllSubscriptions(query: any) {
    const { status, page = 1, limit = 10 } = query;

    const qb = this.subRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.user', 'user')
      .leftJoinAndSelect('sub.organization', 'org')
      .leftJoinAndSelect('sub.plan', 'plan');

    // 🔍 FILTER BY STATUS
    if (status) {
      qb.andWhere('sub.status = :status', { status });
    }

    qb.orderBy('sub.id', 'DESC');

    const [subs, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // ===============================
    // 📊 ADD USAGE DATA
    // ===============================

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const data = await Promise.all(
      subs.map(async (sub) => {
        let used = 0;

        if (sub.organization) {
          used = await this.invoiceRepo.count({
            where: {
              organization: { id: sub.organization.id },
              createdAt: MoreThan(startOfMonth),
            },
          });
        } else if (sub.user) {
          used = await this.invoiceRepo.count({
            where: {
              user: { id: sub.user.id },
              createdAt: MoreThan(startOfMonth),
            },
          });
        }

        return {
          id: sub.id,
          status: sub.status,
          isActive: sub.isActive,

          startDate: sub.startDate,
          endDate: sub.endDate,

          plan: sub.plan,

          user: sub.user
            ? {
                id: sub.user.id,
                name: sub.user.name,
                email: sub.user.email,
              }
            : null,

          organization: sub.organization
            ? {
                id: sub.organization.id,
                name: sub.organization.name,
              }
            : null,

          usage: {
            used,
            limit: sub.plan.invoiceLimit,
            remaining:
              sub.plan.invoiceLimit === -1
                ? 'unlimited'
                : sub.plan.invoiceLimit - used,
          },
        };
      }),
    );

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async getSubscriptionStats() {
    // ===============================
    // 📊 BASIC COUNTS
    // ===============================

    const [active, pending, rejected] = await Promise.all([
      this.subRepo.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.subRepo.count({
        where: { status: SubscriptionStatus.PENDING },
      }),
      this.subRepo.count({
        where: { status: SubscriptionStatus.REJECTED },
      }),
    ]);

    // ===============================
    // 🔁 RECURRING LOGIC
    // ===============================

    const allSubs = await this.subRepo.find({
      relations: ['user', 'organization', 'plan'],
    });

    const map = new Map<string, number>();

    for (const sub of allSubs) {
      const key = sub.organization
        ? `org-${sub.organization.id}`
        : `user-${sub.user?.id}`;

      if (!key) continue;

      map.set(key, (map.get(key) || 0) + 1);
    }

    const totalEntities = map.size;

    let repeatSubscribers = 0;
    let totalSubscriptions = 0;

    map.forEach((count) => {
      totalSubscriptions += count;
      if (count > 1) repeatSubscribers++;
    });

    const avgSubscriptionsPerUser =
      totalEntities === 0 ? 0 : totalSubscriptions / totalEntities;

    const retentionRate =
      totalEntities === 0 ? 0 : (repeatSubscribers / totalEntities) * 100;

    // ===============================
    // 🧠 PLAN-WISE STATS
    // ===============================

    const planStatsMap = new Map<
      number,
      {
        name: string;
        total: number;
        active: number;
        pending: number;
        rejected: number;
      }
    >();

    for (const sub of allSubs) {
      const planId = sub.plan.id;

      if (!planStatsMap.has(planId)) {
        planStatsMap.set(planId, {
          name: sub.plan.name,
          total: 0,
          active: 0,
          pending: 0,
          rejected: 0,
        });
      }

      const stats = planStatsMap.get(planId)!;

      stats.total++;

      if (sub.status === SubscriptionStatus.ACTIVE) stats.active++;
      if (sub.status === SubscriptionStatus.PENDING) stats.pending++;
      if (sub.status === SubscriptionStatus.REJECTED) stats.rejected++;
    }

    const planWise = Array.from(planStatsMap.values());

    // ===============================
    // 📊 FINAL RESPONSE
    // ===============================

    return {
      counts: {
        active,
        pending,
        rejected,
      },

      recurring: {
        totalEntities,
        repeatSubscribers,
        avgSubscriptionsPerUser: Number(avgSubscriptionsPerUser.toFixed(2)),
      },

      retention: {
        retentionRate: Number(retentionRate.toFixed(2)),
      },

      planWise, // 🔥 NEW SECTION
    };
  }
}
