import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { Repository } from 'typeorm';
import { User, OrgRole, Role } from 'src/user/user.entity';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { InviteStatus, OrganizationInvite } from './organization-invite.entity';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationEvent } from 'src/notification/notification-event.enum';
import { Subscription } from 'src/subscription/subscription.entity';
import { Usage } from 'src/usage/usage.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(OrganizationInvite)
    private inviteRepo: Repository<OrganizationInvite>,
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,

    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,

    @InjectRepository(Usage)
    private usageRepo: Repository<Usage>,
  ) {}

  // ✅ CREATE ORGANIZATION
  async createOrganization(name: string, user: any) {
    const existingUser = await this.userRepo.findOne({
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!existingUser) {
      throw new BadRequestException('User not found');
    }

    if (existingUser.organization) {
      throw new BadRequestException('Already in an organization');
    }

    const org = this.orgRepo.create({
      name,
      owner: { id: user.sub },
    });

    const savedOrg = await this.orgRepo.save(org);

    // ✅ attach user as OWNER
    existingUser.organization = savedOrg;
    existingUser.orgRole = OrgRole.OWNER;

    await this.userRepo.save(existingUser);

    // notify user
    if (existingUser.fcmToken) {
      await this.notificationService.sendEventToUsers(
        NotificationEvent.ORGANIZATION_CREATED,
        { userId: existingUser.id },
        {
          orgName: savedOrg.name,
          name: existingUser.name,
        },
      );
    }

    return savedOrg;
  }

  // ✅ INVITE USER Owner only
  async inviteUser(identifier: string, currentUser: any) {
    const owner = await this.userRepo.findOne({
      where: { id: currentUser.sub },
      relations: ['organization'],
    });

    if (!owner || owner.orgRole !== 'owner') {
      throw new ForbiddenException('Only owner can invite');
    }

    if (!owner.organization) {
      throw new NotFoundException('No organization found');
    }

    // 🔥 CHECK USER LIMIT
    await this.subscriptionService.checkUserLimit(currentUser);

    const user = await this.userRepo.findOne({
      where: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.organization) {
      throw new ForbiddenException('User already in organization');
    }

    // ❌ prevent duplicate invites
    const existing = await this.inviteRepo.findOne({
      where: {
        invitedUser: { id: user.id },
        organization: { id: owner.organization.id },
        status: InviteStatus.PENDING,
      },
    });

    if (existing) {
      throw new ForbiddenException('Invite already sent');
    }

    const invite = await this.inviteRepo.save({
      organization: owner.organization,
      invitedUser: user,
      status: InviteStatus.PENDING,
    });

    // 🔔 notify invited user
    // notify user
    if (user.fcmToken) {
      await this.notificationService.sendEventToUsers(
        NotificationEvent.USER_INVITED,
        { userId: user.id },
        {
          orgName: owner.organization.name,
          name: user.name,
        },
      );
    }

    return invite;
  }

  // ✅ ACCEPT INVITE
  async acceptInvite(inviteId: number, currentUser: any) {
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId },
      relations: ['invitedUser', 'organization'],
    });

    if (!invite) throw new NotFoundException('Invite not found');

    if (invite.invitedUser.id !== currentUser.sub) {
      throw new ForbiddenException('Not your invite');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new ForbiddenException('Already handled');
    }

    const user = invite.invitedUser;

    if (user.organization) {
      throw new ForbiddenException('Already in organization');
    }

    // ✅ join org
    user.organization = invite.organization;
    user.orgRole = OrgRole.STAFF;

    await this.userRepo.save(user);

    invite.status = InviteStatus.ACCEPTED;
    await this.inviteRepo.save(invite);

    // notify user
    if (user.fcmToken) {
      await this.notificationService.sendEventToUsers(
        NotificationEvent.INVITE_ACCEPTED,
        { userId: user.id },
        {
          orgName: invite.organization.name,
          name: user.name,
        },
      );
    }

    return { message: 'Joined organization' };
  }

  // ✅ REJECT INVITE
  async rejectInvite(inviteId: number, currentUser: any) {
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId },
      relations: ['invitedUser'],
    });

    if (!invite) throw new NotFoundException('Invite not found');

    if (invite.invitedUser.id !== currentUser.sub) {
      throw new ForbiddenException('Not your invite');
    }

    invite.status = InviteStatus.REJECTED;
    await this.inviteRepo.save(invite);

    // notify user
    if (invite.invitedUser.fcmToken) {
      await this.notificationService.sendEventToUsers(
        NotificationEvent.INVITE_REJECTED,
        { userId: invite.invitedUser.id },
        {
          name: invite.invitedUser.name,
        },
      );
    }

    return invite;
  }

  async removeUser(userId: number, currentUser: any) {
    const owner = await this.userRepo.findOne({
      where: { id: currentUser.sub },
      relations: ['organization'],
    });

    if (!owner || owner.orgRole !== 'owner') {
      throw new ForbiddenException('Only owner can remove users');
    }

    if (!owner.organization) {
      throw new NotFoundException('No organization found');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ❌ cannot remove yourself
    if (user.id === owner.id) {
      throw new ForbiddenException('Owner cannot remove himself');
    }

    // ❌ cannot remove another owner (future-safe)
    if (user.orgRole === 'owner') {
      throw new ForbiddenException('Cannot remove owner');
    }

    // ❌ must belong to same org
    if (user.organization?.id !== owner.organization.id) {
      throw new ForbiddenException('User not in your organization');
    }

    // ✅ REMOVE USER FROM ORG
    const removedUser = user;

    // remove logic...
    user.organization = null;
    user.orgRole = OrgRole.USER;

    await this.userRepo.save(user);

    // 🔔 notify removed user
    if (removedUser.fcmToken) {
      await this.notificationService.sendEventToUsers(
        NotificationEvent.USER_REMOVED,
        { userId: removedUser.id },
        {
          name: removedUser.name,
          orgName: owner.organization.name,
        },
      );
    }
  }

  // ✅ GET MY INVITES
  async getMyInvites(currentUser: any) {
    return this.inviteRepo.find({
      where: {
        invitedUser: { id: currentUser.sub },
        status: InviteStatus.PENDING,
      },
      relations: ['organization'],
      order: { id: 'DESC' },
    });
  }

  // ✅ GET ORG USERS
  async getOrganizationUsers(currentUser: any) {
    const user = await this.userRepo.findOne({
      where: { id: currentUser.sub },
      relations: ['organization'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.organization) {
      throw new BadRequestException('User is not in any organization');
    }

    // 🔐 OPTIONAL: restrict to owner only
    if (user.orgRole !== 'owner') {
      throw new ForbiddenException('Only owner can view users');
    }

    const users = await this.userRepo.find({
      where: {
        organization: { id: user.organization.id },
      },
      select: ['id', 'name', 'email', 'phone', 'orgRole', 'createdAt'],
      order: { id: 'DESC' },
    });

    return {
      organizationId: user.organization.id,
      totalUsers: users.length,
      users,
    };
  }



  // ==============================
  // 1️⃣ BASIC ORG LIST
  // ==============================
  async getAllOrganizations() {
    const orgs = await this.orgRepo.find({
      select: {
        id: true,
        name: true,
      },
      order: { id: 'DESC' },
    });

    return orgs;
  }

  // ==============================
  // 2️⃣ ORG STATS (users + plan + usage)
  // ==============================
  async getOrganizationStats() {
    const orgs = await this.orgRepo.find();

    const result = await Promise.all(
      orgs.map(async (org) => {
        const userCount = await this.userRepo.count({
          where: { organization: { id: org.id } },
        });

        const subscription = await this.subRepo.findOne({
          where: {
            organization: { id: org.id },
            isActive: true,
          },
          relations: ['plan'],
        });

        const month = this.getCurrentMonth();

        const usage = await this.usageRepo.findOne({
          where: {
            organization: { id: org.id },
            month,
          },
        });

        return {
          id: org.id,
          name: org.name,
          userCount,
          planName: subscription?.plan?.name || null,
          usage: usage?.invoiceCount || 0,
        };
      }),
    );

    return result;
  }

  // ==============================
  // 3️⃣ FULL ORG DETAIL BY ID
  // ==============================
  async getOrganizationById(id: number) {
    const org = await this.orgRepo.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!org) throw new NotFoundException('Organization not found');

    const users = await this.userRepo.find({
      where: { organization: { id } },
    });

    const subscription = await this.subRepo.findOne({
      where: {
        organization: { id },
        isActive: true,
      },
      relations: ['plan'],
    });

    const month = this.getCurrentMonth();

    const usage = await this.usageRepo.findOne({
      where: {
        organization: { id },
        month,
      },
    });

    return {
      organization: org,
      users,
      subscription,
      usage,
    };
  }

  // helper
  private getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
