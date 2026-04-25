import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, VerificationStatus } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Subscription } from 'src/subscription/subscription.entity';
import { Plan } from 'src/plan/plan.entity';
import { UserProfileResponse } from './user-profile.response';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,

    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
  ) {}

  // 🔐 Helper
  private excludePassword(user: User) {
    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  }

  // 🔐 Helper

  // ==============================
  // ⚡ AUTO ASSIGN FREE PLAN
  // ==============================
  public async assignFreePlan(user: User) {
    const freePlan = await this.planRepo.findOne({
      where: { name: 'Free' },
    });

    if (!freePlan) return;

    const existing = await this.subscriptionRepo.findOne({
      where: { user: { id: user.id } },
    });

    if (existing) return; // avoid duplicates

    await this.subscriptionRepo.save({
      user,
      plan: freePlan,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      isActive: true,
    });
  }

  // ================= ADMIN =================

  async create(dto: CreateUserDto): Promise<UserProfileResponse> {
    const user = this.userRepository.create(dto);
    const saved = await this.userRepository.save(user);

    // 🔥 assign free plan
    await this.assignFreePlan(saved);

    return this.buildUserProfile(saved);
  }

  async findAll(): Promise<UserProfileResponse[]> {
    const users = await this.userRepository.find();
    return Promise.all(users.map((u) => this.buildUserProfile(u)));
  }

  async findOne(id: number): Promise<UserProfileResponse> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new NotFoundException('User not found');

    return this.buildUserProfile(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);

    return this.excludePassword(saved) as User;
  }

  async delete(id: number) {
    const result = await this.userRepository.delete(id);

    if (!result.affected) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User deleted successfully' };
  }

  // 🔥 ADMIN: verification control
  async updateVerificationStatus(
    id: number,
    status: VerificationStatus,
  ): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new NotFoundException('User not found');

    user.verificationStatus = status;

    const saved = await this.userRepository.save(user);

    return this.excludePassword(saved) as User;
  }

  // ================= USER SELF =================

  async findMe(user): Promise<UserProfileResponse> {
    const found = await this.userRepository.findOne({
      where: { id: user.sub },
    });

    if (!found) throw new NotFoundException('User not found');

    return this.buildUserProfile(found);
  }

  async updateMe(user, dto: UpdateProfileDto): Promise<UserProfileResponse> {
    const existing = await this.userRepository.findOne({
      where: { id: user.sub },
    });

    if (!existing) throw new NotFoundException('User not found');

    Object.assign(existing, dto);

    const saved = await this.userRepository.save(existing);

    return this.buildUserProfile(saved);
  }

  async deleteMe(user) {
    const result = await this.userRepository.delete(user.sub);

    if (!result.affected) {
      throw new NotFoundException('User not found');
    }

    return { message: 'Account deleted' };
  }

  private async buildUserProfile(user: User) {
    const fullUser = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['organization'],
    });

    if (!fullUser) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { user: { id: user.id } },
      relations: ['plan'],
      order: { id: 'DESC' },
    });

    return {
      user: this.excludePassword(fullUser),

      organization: fullUser.organization || null,

      subscription: subscription || null,

      plan: subscription?.plan || null,

      usage: {
        invoicesUsed: 0, // 🔥 later connect to UsageService
        userUsed: 0,
      },
    };
  }

  async search(query: any) {
    const {
      name,
      email,
      phone,
      tax_number,
      orgRole,
      verificationStatus,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      page = 1,
      limit = 10,
    } = query;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization');

    // ================= FILTERS =================

    if (name) {
      qb.andWhere('user.name ILIKE :name', {
        name: `%${name}%`,
      });
    }

    if (email) {
      qb.andWhere('user.email ILIKE :email', {
        email: `%${email}%`,
      });
    }

    if (phone) {
      qb.andWhere('user.phone ILIKE :phone', {
        phone: `%${phone}%`,
      });
    }

    if (tax_number) {
      qb.andWhere('user.tax_number ILIKE :tax', {
        tax: `%${tax_number}%`,
      });
    }

    if (orgRole) {
      qb.andWhere('user.orgRole = :orgRole', { orgRole });
    }

    if (verificationStatus) {
      qb.andWhere('user.verificationStatus = :status', {
        status: verificationStatus,
      });
    }

    if (createdFrom && createdTo) {
      qb.andWhere('user.createdAt BETWEEN :from AND :to', {
        from: createdFrom,
        to: createdTo,
      });
    }

    if (updatedFrom && updatedTo) {
      qb.andWhere('user.updatedAt BETWEEN :from2 AND :to2', {
        from2: updatedFrom,
        to2: updatedTo,
      });
    }

    qb.orderBy('user.id', 'DESC');

    const [users, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = await Promise.all(users.map((u) => this.buildUserProfile(u)));

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async applyForVerification(user): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { id: user.sub },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    // ❌ Already verified
    if (existing.verificationStatus === VerificationStatus.VERIFIED) {
      throw new BadRequestException('Already verified');
    }

    // ❌ Already applied
    if (existing.verificationStatus === VerificationStatus.PENDING) {
      throw new BadRequestException('Verification already in progress');
    }

    // ✅ APPLY
    existing.verificationStatus = VerificationStatus.PENDING;

    const saved = await this.userRepository.save(existing);

    return this.excludePassword(saved) as User;
  }
}
