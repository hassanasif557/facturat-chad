import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private repo: Repository<Product>,
  ) {}

  // ================= GLOBAL (ADMIN) =================

  async createGlobal(data) {
    return this.repo.save({
      ...data,
      isGlobal: true,
      user: null,
    });
  }

  async getGlobal() {
    return this.repo.find({ where: { isGlobal: true } });
  }

  async updateGlobal(id: number, data) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async deleteGlobal(id: number) {
    await this.repo.delete(id);
    return { message: 'Deleted' };
  }

  // ================= USER PERSONAL =================

  async createUserProduct(data, user) {
    return this.repo.save({
      ...data,
      isGlobal: false,
      user: { id: user.sub },
    });
  }

  async getUserProducts(user) {
    return this.repo.find({
      where: { user: { id: user.sub }, isGlobal: false },
    });
  }

  async updateUserProduct(id: number, data, user) {
    const product = await this.repo.findOne({
    where: { id },
    relations: ['user'],
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  if (product.user.id !== user.sub) {
    throw new ForbiddenException('Not your product');
  }

    Object.assign(product, data);
    return this.repo.save(product);
  }

  async deleteUserProduct(id: number, user) {
    const product = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!product) {
    throw new NotFoundException('Product not found');
  }

    if (product.user.id !== user.sub) {
      throw new ForbiddenException('Not your product');
    }

    await this.repo.delete(id);
    return { message: 'Deleted' };
  }
}