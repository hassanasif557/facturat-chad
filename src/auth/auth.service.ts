import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { UserService } from 'src/user/user.service';

import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Role, User, VerificationStatus } from 'src/user/user.entity';

import { Subscription } from 'src/subscription/subscription.entity';

import { Plan } from 'src/plan/plan.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,

    private jwtService: JwtService,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,

    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
  ) {}

  // ================= GENERATE OTP =================
  private generateOtp() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // ================= REGISTER =================
  async register(data: Partial<User>, file?: Express.Multer.File) {
    if (!data.email || !data.password) {
      throw new BadRequestException('Email and password required');
    }

    const emailExists = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    const phoneExists = await this.userRepository.findOne({
      where: { phone: data.phone },
    });

    if (phoneExists) {
      throw new BadRequestException('Phone number already exists');
    }

    const taxExists = await this.userRepository.findOne({
      where: { tax_number: data.tax_number },
    });

    if (taxExists) {
      throw new BadRequestException('Tax number already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const otp = this.generateOtp();

    const userData = this.userRepository.create({
      ...data,

      password: hashedPassword,

      profilePicture: file
        ? `/uploads/profile-pictures/${file.filename}`
        : undefined,

      role: Role.USER,

      verificationStatus: VerificationStatus.NOT_VERIFIED,

      otp,

      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),

      otpVerified: false,
    });

    const user = await this.userRepository.save(userData);

    await this.userService.assignFreePlan(user);

    return {
      success: true,
      message: 'OTP sent successfully',

      otp,
    };
  }

  // ================= LOGIN =================
  async login(phone: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { phone },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const otp = this.generateOtp();

    user.otp = otp;

    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    user.otpVerified = false;

    await this.userRepository.save(user);

    return {
      success: true,
      message: 'OTP sent successfully',

      otp,
    };
  }

  // ================= VERIFY OTP =================
  async verifyOtp(phone: string, otp: string) {
    const user = await this.userRepository.findOne({
      where: { phone },
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

    user.otpVerified = true;

    user.otp = '';

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    const fullProfile = await this.buildUserResponse(user);

    return {
      ...fullProfile,
      ...tokens,
    };
  }

  // ================= FORGOT PASSWORD =================
  async forgotPassword(phone: string) {
    const user = await this.userRepository.findOne({
      where: { phone },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otp = this.generateOtp();

    user.otp = otp;

    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    user.otpVerified = false;

    await this.userRepository.save(user);

    return {
      success: true,
      message: 'OTP sent successfully',

      otp,
    };
  }

  // ================= RESET PASSWORD =================
  async resetPassword(userId: number, password: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;

    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Password reset successful',
    };
  }

  // ================= TOKEN GENERATION =================
  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      phone: user.phone,
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

  // ================= REFRESH =================
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

      return {
        ...fullProfile,
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ================= LOGOUT =================
  async logout(userId: number) {
    await this.userRepository.update(
      { id: userId },
      { refreshToken: '' },
    );

    return {
      message: 'Logged out successfully',
    };
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
}