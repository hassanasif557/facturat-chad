import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from './payment-method.entity';
import { Repository } from 'typeorm';
import { CreatePaymentMethodDto } from './create-payment-method.dto';
import { UpdatePaymentMethodDto } from './update-payment-method.dto';

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectRepository(PaymentMethod)
    private repo: Repository<PaymentMethod>,
  ) {}

  // ================= CREATE =================
  async create(dto: CreatePaymentMethodDto, user: any) {
    const method = this.repo.create({
      ...dto,
      user: { id: user.sub },
    } as any);

    return this.repo.save(method);
  }

  // ================= GET MY METHODS =================
  async findMy(user: any) {
    return this.repo.find({
      where: { user: { id: user.sub } },
      order: { id: 'DESC' },
    });
  }

  // ================= GET ONE =================
  async findOne(id: number, user: any) {
    const method = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!method) throw new NotFoundException('Payment method not found');

    if (method.user.id !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    return method;
  }

  // ================= UPDATE =================
  async update(
    id: number,
    dto: UpdatePaymentMethodDto,
    user: any,
  ) {
    const method = await this.findOne(id, user);

    Object.assign(method, dto);

    return this.repo.save(method);
  }

  // ================= DELETE =================
  async delete(id: number, user: any) {
    const method = await this.findOne(id, user);

    await this.repo.remove(method);

    return { message: 'Payment method deleted successfully' };
  }
}