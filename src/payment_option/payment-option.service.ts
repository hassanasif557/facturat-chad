import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentOption } from './payment-option.entity';
import { Repository } from 'typeorm';
import { CreatePaymentOptionDto } from './create-payment-option.dto';

@Injectable()
export class PaymentOptionService {
  constructor(
    @InjectRepository(PaymentOption)
    private repo: Repository<PaymentOption>,
  ) {}

  // ================= ADMIN =================

  async create(dto: CreatePaymentOptionDto) {
    // prevent duplicate types
    const exists = await this.repo.findOne({
      where: { type: dto.type },
    });

    if (exists) {
      throw new BadRequestException('Option already exists');
    }

    const option = this.repo.create(dto);
    return this.repo.save(option);
  }

  async findAllAdmin() {
    return this.repo.find();
  }

  async update(id: number, dto: CreatePaymentOptionDto) {
    const option = await this.repo.findOne({ where: { id } });

    if (!option) throw new NotFoundException('Option not found');

    Object.assign(option, dto);
    return this.repo.save(option);
  }

  async delete(id: number) {
    const result = await this.repo.delete(id);

    if (!result.affected) {
      throw new NotFoundException('Option not found');
    }

    return { message: 'Deleted' };
  }

  // ================= USER =================

  async findActive() {
    return this.repo.find({
      where: { isActive: true },
    });
  }
}