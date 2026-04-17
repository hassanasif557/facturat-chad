import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // ✅ CREATE
  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    const saved = await this.userRepository.save(user);

    saved.password = ""; // 🔐 never return password
    return saved;
  }

  // ✅ ADMIN: GET ALL USERS
  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find();

    // 🔐 remove passwords
    return users.map((u) => {
       u.password = "";
      return u;
    });
  }

  // ✅ ADMIN: GET ONE USER
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${id} not found`,
      );
    }

     user.password = "";
    return user;
  }

  // ✅ ADMIN: UPDATE ANY USER
  async update(
    id: number,
    updatedData: Partial<User>,
  ): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${id} not found`,
      );
    }

    const updated = Object.assign(user, updatedData);
    const saved = await this.userRepository.save(updated);

     saved.password = ""; // 🔐 never return password
    return saved;
  }

  // ✅ ADMIN: DELETE ANY USER
  async delete(id: number): Promise<{ message: string }> {
    const result = await this.userRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(
        `User with ID ${id} not found`,
      );
    }

    return {
      message: `User with ID ${id} deleted successfully`,
    };
  }

  // ================= USER SELF =================

  // ✅ GET OWN PROFILE
  async findMe(user): Promise<User> {
    const found = await this.userRepository.findOne({
      where: { id: user.sub },
    });

    if (!found) {
      throw new NotFoundException('User not found');
    }

     found.password = "";
    return found;
  }

  // ✅ UPDATE OWN PROFILE
  async updateMe(user, data): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { id: user.sub },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = Object.assign(existing, data);
    const saved = await this.userRepository.save(updated);

    delete saved.password;
    return saved;
  }

  // ✅ DELETE OWN ACCOUNT
  async deleteMe(user): Promise<{ message: string }> {
    const result = await this.userRepository.delete(user.sub);

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    return { message: 'Your account has been deleted' };
  }

  // ================= SEARCH (ADMIN) =================

  async search(filters: {
    name?: string;
    email?: string;
    verificationStatus?: string;
  }): Promise<User[]> {
    const query = this.userRepository.createQueryBuilder('user');

    if (filters.name) {
      query.andWhere('user.name ILIKE :name', {
        name: `%${filters.name}%`,
      });
    }

    if (filters.email) {
      query.andWhere('user.email ILIKE :email', {
        email: `%${filters.email}%`,
      });
    }

    if (filters.verificationStatus) {
      query.andWhere(
        'user.verificationStatus = :status',
        { status: filters.verificationStatus },
      );
    }

    const users = await query.getMany();

    return users.map((u) => {
    const { password, ...safeUser } = u;
    return safeUser as User;
    });
  }
}