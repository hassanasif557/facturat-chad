import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { UserService } from 'src/user/user.service';

import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';

import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';

import { Role, User, VerificationStatus } from 'src/user/user.entity';

import { Subscription } from 'src/subscription/subscription.entity';

import { Plan } from 'src/plan/plan.entity';
import { Invoice } from 'src/invoice/invoice.entity';
import { normalizePhoneE164, maskPhone } from 'src/common/utils/phone.util';
import { DeviceToken } from 'src/customer/entities/device-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,

    private jwtService: JwtService,
    @InjectDataSource()
    private dataSource: DataSource,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,

    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
  ) {}

  // ================= GENERATE OTP =================
  private generateOtp() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private createChallengeId(prefix = 'otp') {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  async register(
    data: {
      name: string;
      email: string;
      password: string;
      phone: string;
      tax_number?: string;
      role?: 'user' | 'customer' | Role;
    },
    file?: Express.Multer.File,
  ) {
    if (!data.email || !data.password) {
      throw new BadRequestException('Email and password required');
    }

    const normalizedPhone = normalizePhoneE164(data.phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Phone must use E.164 format');
    }

    const isCustomer = data.role === Role.CUSTOMER || data.role === ('customer' as any);

    const emailExists = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    const phoneExists = await this.userRepository.findOne({
      where: [{ phone: normalizedPhone }, { phoneNormalized: normalizedPhone }],
    });

    if (phoneExists) {
      throw new BadRequestException('Phone number already exists');
    }

    if (!isCustomer && data.tax_number) {
      const taxExists = await this.userRepository.findOne({
        where: { tax_number: data.tax_number },
      });
      if (taxExists) {
        throw new BadRequestException('Tax number already exists');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const otp = this.generateOtp();
    const challengeId = this.createChallengeId();

    const userData = this.userRepository.create({
      ...data,
      phone: normalizedPhone,
      phoneNormalized: normalizedPhone,
      password: hashedPassword,
      profilePicture: file
        ? `/uploads/profile-pictures/${file.filename}`
        : undefined,
      role: isCustomer ? Role.CUSTOMER : Role.USER,
      verificationStatus: VerificationStatus.NOT_VERIFIED,
      otp,
      otpChallengeId: challengeId,
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
      otpVerified: false,
      phoneVerifiedAt: null as any,
      notificationPreferences: {
        pushNewInvoice: true,
        pushDueReminder: true,
        pushPaymentStatus: true,
        emailReceipts: true,
      },
    });

    const user = await this.userRepository.save(userData);
    await this.userService.assignFreePlan(user);

    if (isCustomer) {
      return {
        success: true,
        data: {
          challengeId,
          phoneMasked: maskPhone(normalizedPhone),
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
        },
      };
    }

    return { success: true, message: 'OTP sent successfully', otp };
  }

  async login(phone: string, password: string, requestedRole?: string) {
    const normalizedPhone = normalizePhoneE164(phone);
    if (!normalizedPhone) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.userRepository.findOne({
      where: [{ phone: normalizedPhone }, { phoneNormalized: normalizedPhone }],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (requestedRole === 'customer' && user.role !== Role.CUSTOMER) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const otp = this.generateOtp();
    const challengeId = this.createChallengeId();
    user.otp = otp;
    user.otpChallengeId = challengeId;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    user.otpVerified = false;

    await this.userRepository.save(user);

    if (requestedRole === 'customer' || user.role === Role.CUSTOMER) {
      return {
        success: true,
        data: {
          challengeId,
          phoneMasked: maskPhone(normalizedPhone),
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
        },
      };
    }

    return { success: true, message: 'OTP sent successfully', otp };
  }

  async verifyOtp(
    phone: string,
    otp: string,
    challengeId?: string,
    device?: { deviceId?: string; platform?: string; appVersion?: string },
  ) {
    const normalizedPhone = normalizePhoneE164(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Invalid phone');
    }

    const user = await this.userRepository.findOne({
      where: [{ phone: normalizedPhone }, { phoneNormalized: normalizedPhone }],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (!user.otpExpiry || new Date() > user.otpExpiry) {
      throw new BadRequestException('OTP expired');
    }

    if (challengeId && user.otpChallengeId !== challengeId) {
      throw new BadRequestException('Invalid challenge');
    }

    user.otpVerified = true;
    user.phoneVerifiedAt = new Date();
    user.phoneNormalized = normalizedPhone;
    user.otp = '';
    user.otpChallengeId = '';

    await this.userRepository.save(user);
    const claimedInvoiceCount = await this.claimInvoicesForCustomer(user);

    if (device?.deviceId) {
      const existing = await this.deviceTokenRepo.findOne({
        where: {
          user: { id: user.id },
          deviceId: device.deviceId,
        },
        relations: ['user'],
      });
      if (existing) {
        existing.platform = device.platform || existing.platform;
        existing.appVersion = device.appVersion || existing.appVersion;
        await this.deviceTokenRepo.save(existing);
      }
    }

    const tokens = await this.generateTokens(user);
    const fullProfile = await this.buildUserResponse(user);

    if (user.role === Role.CUSTOMER) {
      return {
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresInSeconds: 900,
          user: {
            id: user.id,
            name: user.name,
            phone: user.phoneNormalized || user.phone,
            email: user.email,
            roles: ['customer'],
            activeRole: 'customer',
            phoneVerifiedAt: user.phoneVerifiedAt?.toISOString(),
          },
          claimedInvoiceCount,
        },
      };
    }

    return {
      ...fullProfile,
      ...tokens,
    };
  }

  async forgotPassword(phone: string) {
    const normalizedPhone = normalizePhoneE164(phone);
    if (!normalizedPhone) {
      return {
        success: true,
        data: {
          message: 'If the account exists a code has been sent',
          expiresInSeconds: 300,
        },
      };
    }

    const user = await this.userRepository.findOne({
      where: [{ phone: normalizedPhone }, { phoneNormalized: normalizedPhone }],
    });

    if (user) {
      const otp = this.generateOtp();
      user.otp = otp;
      user.otpChallengeId = this.createChallengeId('otp_reset');
      user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
      user.otpVerified = false;
      await this.userRepository.save(user);
    }

    return {
      success: true,
      data: {
        message: 'If the account exists a code has been sent',
        expiresInSeconds: 300,
      },
    };
  }

  async resetPassword(
    userId: number | undefined,
    payload: {
      challengeId?: string;
      otp?: string;
      phone?: string;
      password: string;
    },
  ) {
    let user: User | null = null;

    if (payload.challengeId && payload.otp && payload.phone) {
      const normalizedPhone = normalizePhoneE164(payload.phone);
      if (!normalizedPhone) {
        throw new BadRequestException('Invalid phone');
      }
      user = await this.userRepository.findOne({
        where: [{ phone: normalizedPhone }, { phoneNormalized: normalizedPhone }],
      });
      if (
        !user ||
        user.otpChallengeId !== payload.challengeId ||
        user.otp !== payload.otp ||
        !user.otpExpiry ||
        new Date() > user.otpExpiry
      ) {
        throw new BadRequestException('Invalid challenge');
      }
    } else if (userId) {
      user = await this.userRepository.findOne({
        where: { id: userId },
      });
    } else {
      throw new BadRequestException(
        'Provide either authenticated user or challengeId+phone+otp',
      );
    }

    if (!user) throw new BadRequestException('User not found');

    const hashedPassword = await bcrypt.hash(payload.password, 10);
    user.password = hashedPassword;
    user.refreshToken = '';
    user.otp = '';
    user.otpChallengeId = '';
    await this.userRepository.save(user);

    await this.deviceTokenRepo.delete({ user: { id: user.id } as User });
    return {
      success: true,
      data: { message: 'Password updated' },
    }
  }

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      phone: user.phoneNormalized || user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);

    await this.userRepository.update(user.id, {
      refreshToken: hashedRefresh,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException();
      }

      const isMatch = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );

      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);

      const fullProfile = await this.buildUserResponse(user);

      if (user.role === Role.CUSTOMER) {
        return {
          success: true,
          data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresInSeconds: 900,
          },
        };
      }

      return {
        ...fullProfile,
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: number, refreshToken?: string, deviceId?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    if (refreshToken && user.refreshToken) {
      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }
    }

    await this.userRepository.update(
      { id: userId },
      { refreshToken: '' },
    );

    if (deviceId) {
      await this.deviceTokenRepo.delete({ user: { id: userId } as User, deviceId });
    }
  }

  // ================= HELPER =================
  excludePassword(user: User) {
    const { password, refreshToken, ...safeUser } = user;

    return safeUser;
  }

  // ================= USER RESPONSE =================
  private async buildUserResponse(user: User) {
    const fullUser = await this.userRepository.findOne({
      where: { id: user.id },

      relations: ['organization'],
    });

    const subscription = await this.subRepo.findOne({
      where: {
        user: { id: user.id },
      },

      relations: ['plan', 'organization'],

      order: { id: 'DESC' },
    });

    return {
      user: this.excludePassword(fullUser!),

      organization: fullUser?.organization || null,

      subscription: subscription || null,

      plan: subscription?.plan || null,

      usage: {
        invoicesUsed: 0,

        userUsed: 0,
      },
    };
  }

  private async claimInvoicesForCustomer(user: User): Promise<number> {
    if (user.role !== Role.CUSTOMER || !user.phoneNormalized) return 0;

    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Invoice)
        .set({
          customerUser: { id: user.id } as User,
        })
        .where(`"customerUserId" IS NULL`)
        .andWhere(`"customerPhoneNormalized" = :phone`, {
          phone: user.phoneNormalized,
        })
        .andWhere(`status != :cancelled`, { cancelled: 'cancelled' })
        .execute();

      return result.affected || 0;
    });
  }
}