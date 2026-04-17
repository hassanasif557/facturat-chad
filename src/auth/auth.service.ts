import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
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

  // ✅ REGISTER
  async register(data: Partial<User>) {
  const existingUsers = await this.userService.search({});
  const exists = existingUsers.find(
    (u) => u.email === data.email,
  );

  if (exists) {
    throw new BadRequestException('Email already exists');
  }

  // ✅ VALIDATION FIX
  if (!data.password) {
    throw new BadRequestException('Password is required');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  console.log
  (data, { hashedPassword }); // 🔐 CHECK HASHING

  const user = await this.userService.create({
    ...data,
    password: hashedPassword,
    role: Role.USER,
    verificationStatus: VerificationStatus.PENDING,
  });

  // ❌ DO NOT STORE THIS
  user.password = '';

  const token = this.generateToken(user);

  return { user, token };
}

  async login(email: string, password: string) {
  const user = await this.userRepository.findOne({
    where: { email },
  });

  console.log('user found for login:', { email, user });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  console.log('Comparing passwords:', {
    provided: password,
    stored: user.password,
  });

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new UnauthorizedException('Invalid credentials');
  }

  user.password = '';

  const token = this.generateToken(user);

  return { user, token };
}

  // ✅ TOKEN GENERATION
  generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role, // ✅ ADD ROLE
    };

    return this.jwtService.sign(payload);
  }
}
