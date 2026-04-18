import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, VerificationStatus } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // 🔐 Helper
  private excludePassword(user: User) {
    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  }

  // ================= ADMIN =================

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(dto);
    const saved = await this.userRepository.save(user);
    return this.excludePassword(saved) as User;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find();
    return users.map((u) => this.excludePassword(u) as User);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new NotFoundException('User not found');

    return this.excludePassword(user) as User;
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

  async findMe(user): Promise<User> {
    const found = await this.userRepository.findOne({
      where: { id: user.sub },
    });

    if (!found) throw new NotFoundException('User not found');

    return this.excludePassword(found) as User;
  }

  async updateMe(user, dto: UpdateProfileDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { id: user.sub },
    });

    if (!existing) throw new NotFoundException('User not found');

    // ✅ ONLY SAFE FIELDS (DTO already restricts this)
    Object.assign(existing, dto);

    const saved = await this.userRepository.save(existing);

    return this.excludePassword(saved) as User;
  }

  async deleteMe(user) {
    const result = await this.userRepository.delete(user.sub);

    if (!result.affected) {
      throw new NotFoundException('User not found');
    }

    return { message: 'Account deleted' };
  }
}