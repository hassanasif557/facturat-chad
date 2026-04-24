import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './plan.entity';
import { CreatePlanDto } from './create-plan.dto';
import { UpdatePlanDto } from './update-plan.dto';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private repo: Repository<Plan>,
  ) {}

  // ✅ CREATE
  async create(dto: CreatePlanDto) {
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

    Object.assign(plan, dto);

    return this.repo.save(plan);
  }

  // ✅ DELETE
  async delete(id: number) {
    const plan = await this.findOne(id);

    await this.repo.delete(id);

    return { message: 'Plan deleted successfully' };
  }
}