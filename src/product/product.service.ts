import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Product } from './product.entity';

import { Invoice } from 'src/invoice/invoice.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private repo: Repository<Product>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {}

  // =====================================================
  // ✅ CREATE GLOBAL PRODUCT
  // =====================================================

  async createGlobal(data: any) {
    // ✅ AVOID DUPLICATE GLOBAL PRODUCT NAME
    const exists = await this.repo.findOne({
      where: {
        name: data.name,
        isGlobal: true,
      },
    });

    if (exists) {
      throw new BadRequestException(
        'Global product with this name already exists',
      );
    }

    return this.repo.save({
      ...data,
      isGlobal: true,
      user: null,
    });
  }

  // =====================================================
  // ✅ ADMIN SEE ALL PRODUCTS
  // =====================================================

  async getAllProducts(query: any) {
    const { page = 1, limit = 10, name, category, isGlobal } = query;

    const qb = this.repo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.user', 'user');

    if (name) {
      qb.andWhere('LOWER(product.name) LIKE LOWER(:name)', {
        name: `%${name}%`,
      });
    }

    if (category) {
      qb.andWhere('LOWER(product.category) LIKE LOWER(:category)', {
        category: `%${category}%`,
      });
    }

    // ✅ FILTER GLOBAL / LOCAL
    if (isGlobal !== undefined) {
      qb.andWhere('product.isGlobal = :isGlobal', {
        isGlobal: isGlobal === 'true',
      });
    }

    qb.orderBy('product.id', 'DESC');

    const [data, total] = await qb
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    return {
      data,
      total,
      page: Number(page),
      lastPage: Math.ceil(total / Number(limit)),
    };
  }

  // =====================================================
  // ✅ POPULAR PRODUCTS FROM INVOICES
  // =====================================================

  async getPopularProducts(limit = 10) {
    const invoices = await this.invoiceRepo.find();

    const map = {};

    invoices.forEach((invoice) => {
      if (!invoice.products?.length) return;

      invoice.products.forEach((p) => {
        const key = p.name?.trim().toLowerCase();

        if (!key) return;

        if (!map[key]) {
          map[key] = {
            name: p.name,
            count: 0,
          };
        }

        map[key].count += 1;
      });
    });

    return Object.values(map)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, Number(limit));
  }

  // =====================================================
  // ✅ GLOBAL PRODUCTS
  // =====================================================

  async getGlobal(query: any) {
    const { page = 1, limit = 10, name, category } = query;

    const qb = this.repo
      .createQueryBuilder('product')
      .where('product.isGlobal = :isGlobal', {
        isGlobal: true,
      });

    if (name) {
      qb.andWhere('LOWER(product.name) LIKE LOWER(:name)', {
        name: `%${name}%`,
      });
    }

    if (category) {
      qb.andWhere('LOWER(product.category) LIKE LOWER(:category)', {
        category: `%${category}%`,
      });
    }

    qb.orderBy('product.id', 'DESC');

    const [data, total] = await qb
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    return {
      data,
      total,
      page: Number(page),
      lastPage: Math.ceil(total / Number(limit)),
    };
  }

  async updateGlobal(id: number, data: any) {
    const product = await this.repo.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // ✅ PREVENT DUPLICATE GLOBAL NAME
    if (data.name) {
      const exists = await this.repo.findOne({
        where: {
          name: data.name,
          isGlobal: true,
        },
      });

      if (exists && exists.id !== id) {
        throw new BadRequestException(
          'Global product with this name already exists',
        );
      }
    }

    Object.assign(product, data);

    return this.repo.save(product);
  }

  async deleteGlobal(id: number) {
    await this.repo.delete(id);

    return {
      message: 'Deleted successfully',
    };
  }

  async addPopularToGlobal(name: string) {
    if (!name) {
      throw new BadRequestException('Product name is required');
    }

    // ✅ already exists globally
    const exists = await this.repo.findOne({
      where: {
        name,
        isGlobal: true,
      },
    });

    if (exists) {
      throw new BadRequestException('Global product already exists');
    }

    // ✅ find most used product with same name
    const localProduct = await this.repo.findOne({
      where: {
        name,
      },
      order: {
        id: 'DESC',
      },
    });

    if (!localProduct) {
      throw new NotFoundException('No product found with this name');
    }

    // ✅ create global product
    const globalProduct = this.repo.create({
      name: localProduct.name,
      price: localProduct.price,
      category: localProduct.category,
      imageUrl: localProduct.imageUrl,
      isGlobal: true
    });

    return this.repo.save(globalProduct);
  }
  

  // =====================================================
  // ✅ USER PRODUCTS
  // =====================================================

  async createUserProduct(data: any, user: any) {
    // ✅ ALLOW DUPLICATES BETWEEN DIFFERENT USERS
    // ✅ BLOCK DUPLICATE FOR SAME USER

    const exists = await this.repo.findOne({
      where: {
        name: data.name,
        user: {
          id: user.sub,
        },
        isGlobal: false,
      },
      relations: ['user'],
    });

    if (exists) {
      throw new BadRequestException('You already added this product');
    }

    return this.repo.save({
      ...data,
      isGlobal: false,
      user: { id: user.sub },
    });
  }

  async getUserProducts(user: any, query: any) {
    const { page = 1, limit = 10, name, category } = query;

    const qb = this.repo
      .createQueryBuilder('product')
      .where('product.isGlobal = :isGlobal', {
        isGlobal: false,
      })
      .andWhere('product.userId = :userId', {
        userId: user.sub,
      });

    if (name) {
      qb.andWhere('LOWER(product.name) LIKE LOWER(:name)', {
        name: `%${name}%`,
      });
    }

    if (category) {
      qb.andWhere('LOWER(product.category) LIKE LOWER(:category)', {
        category: `%${category}%`,
      });
    }

    qb.orderBy('product.id', 'DESC');

    const [data, total] = await qb
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    return {
      data,
      total,
      page: Number(page),
      lastPage: Math.ceil(total / Number(limit)),
    };
  }

  async updateUserProduct(id: number, data: any, user: any) {
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

    // ✅ PREVENT SAME USER DUPLICATES
    if (data.name) {
      const exists = await this.repo.findOne({
        where: {
          name: data.name,
          user: {
            id: user.sub,
          },
          isGlobal: false,
        },
        relations: ['user'],
      });

      if (exists && exists.id !== id) {
        throw new BadRequestException('You already added this product');
      }
    }

    Object.assign(product, data);

    return this.repo.save(product);
  }

  async deleteUserProduct(id: number, user: any) {
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

    return {
      message: 'Deleted successfully',
    };
  }
}
