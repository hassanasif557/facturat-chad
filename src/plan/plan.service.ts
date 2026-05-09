import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Plan } from './plan.entity';

import { CreatePlanDto } from './create-plan.dto';

import { UpdatePlanDto } from './update-plan.dto';

import { Subscription } from 'src/subscription/subscription.entity';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private repo: Repository<Plan>,

    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
  ) {}

  // ✅ CREATE
  async create(dto: CreatePlanDto) {
    // ✅ CHECK DUPLICATE NAME
    const existing = await this.repo.findOne({
      where: {
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Plan with this name already exists',
      );
    }

    const plan = this.repo.create(dto);

    return this.repo.save(plan);
  }

  // ✅ GET ALL
  async findAll() {
    return this.repo.find({
      order: { id: 'DESC' },
    });
  }

  // ✅ GET ONE
  async findOne(id: number) {
    const plan = await this.repo.findOne({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  // ✅ UPDATE
  async update(id: number, dto: UpdatePlanDto) {
    const plan = await this.findOne(id);

    // ✅ CHECK DUPLICATE NAME
    if (dto.name && dto.name !== plan.name) {
      const existing = await this.repo.findOne({
        where: {
          name: dto.name,
        },
      });

      if (existing) {
        throw new BadRequestException(
          'Plan with this name already exists',
        );
      }
    }

    Object.assign(plan, dto);

    return this.repo.save(plan);
  }

  // ✅ DELETE
  async delete(id: number) {
    await this.findOne(id);

    const usage = await this.subRepo.count({
      where: { plan: { id } },
    });

    if (usage > 0) {
      throw new BadRequestException(
        'Cannot delete plan. It is used in subscriptions',
      );
    }

    await this.repo.delete(id);

    return {
      message: 'Plan deleted successfully',
    };
  }
}