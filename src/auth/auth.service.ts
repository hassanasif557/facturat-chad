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
import { NotificationEvent } from 'src/notification/notification-event.enum';
import { NotificationService } from 'src/notification/notification.service';

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

    private notificationService: NotificationService,
  ) {}

  // ================= REGISTER =================
  async register(data: Partial<User>, file?: Express.Multer.File) {
    if (!data.email || !data.password) {
      throw new BadRequestException('Email and password required');
    }

    // ✅ CHECK EMAIL
    const emailExists = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    // ✅ CHECK PHONE
    const phoneExists = await this.userRepository.findOne({
      where: { phone: data.phone },
    });

    if (phoneExists) {
      throw new BadRequestException('Phone number already exists');
    }

    // ✅ NAME EXISTS
    const nameExists = await this.userRepository.findOne({
      where: { name: data.name },
    });

    if (nameExists) {
      throw new BadRequestException('Name already exists');
    }

    // ✅ TAX NUMBER EXISTS
    const taxExists = await this.userRepository.findOne({
      where: { tax_number: data.tax_number },
    });

    if (taxExists) {
      throw new BadRequestException('Tax number already exists');
    }

    // ✅ HASH PASSWORD
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const userData = this.userRepository.create({
      ...data,

      password: hashedPassword,

      profilePicture: file
        ? `/uploads/profile-pictures/${file.filename}`
        : undefined,

      role: Role.USER,

      verificationStatus: VerificationStatus.NOT_VERIFIED,
    });

    const user = await this.userRepository.save(userData);

    // ✅ ASSIGN FREE PLAN
    await this.userService.assignFreePlan(user);

    const fullProfile = await this.buildUserResponse(user);

    const tokens = await this.generateTokens(user);

    return {
      ...fullProfile,
      ...tokens,
    };
  }

  // ================= LOGIN =================
  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user);

    const fullProfile = await this.buildUserResponse(user);

    // notify user
    if (user?.fcmToken) {
      await this.notificationService.sendEventToUsers(
        NotificationEvent.USER_REGISTERED,
        { userId: user.id },
        {
          name: user.name,
        },
      );
    }

    return {
      ...fullProfile,
      ...tokens,
    };
  }

  // ================= TOKEN GENERATION =================
  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
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

    // 🔐 hash refresh token before storing
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);

    await this.userRepository.update(user.id, {
      refreshToken: hashedRefresh,
    });

    return { accessToken, refreshToken };
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

      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);

      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 🔁 ROTATE TOKENS
      const tokens = await this.generateTokens(user);
      const fullProfile = await this.buildUserResponse(user);

      return {
        ...fullProfile,
        ...tokens,
      };
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ================= LOGOUT =================
  async logout(userId: number) {
    if (!userId) {
      throw new UnauthorizedException('Invalid user');
    }

    await this.userRepository.update({ id: userId }, { refreshToken: '' });

    return { message: 'Logged out successfully' };
  }

  // ================= HELPER =================
  excludePassword(user: User) {
    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  }

  // ================= USER FULL PROFILE =================
  private async buildUserResponse(user: User) {
    const fullUser = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['organization'],
    });

    if (!fullUser) return null;

    const subscription = await this.subRepo.findOne({
      where: {
        user: { id: user.id },
      },
      relations: ['plan', 'organization'],
      order: { id: 'DESC' },
    });

    return {
      user: this.excludePassword(fullUser),

      organization: fullUser.organization || null,

      subscription: subscription || null,

      plan: subscription?.plan || null,

      usage: {
        invoicesUsed: 0, // 🔥 replace later from UsageService
        userUsed: 0,
      },

      subscriptionHistory: [], // 🔥 add later if needed
    };
  }
}
