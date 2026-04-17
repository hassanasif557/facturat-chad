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

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // ================= REGISTER =================
  async register(data: Partial<User>) {
    if (!data.email || !data.password) {
      throw new BadRequestException('Email and password required');
    }

    const exists = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.userRepository.save({
      ...data,
      password: hashedPassword,
      role: Role.USER,
      verificationStatus: VerificationStatus.PENDING,
    });

    const tokens = await this.generateTokens(user);

    return {
      user: this.excludePassword(user),
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

    return {
      user: this.excludePassword(user),
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

      const isMatch = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );

      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 🔁 ROTATE TOKENS
      return this.generateTokens(user);
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ================= LOGOUT =================
  async logout(userId: number) {
  if (!userId) {
    throw new UnauthorizedException('Invalid user');
  }

  await this.userRepository.update(
    { id: userId },
    { refreshToken: '' },
  );

  return { message: 'Logged out successfully' };
}

  // ================= HELPER =================
  excludePassword(user: User) {
    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  }
}