import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './plan.entity';
import { PlanService } from './plan.service';
import { PlanController } from './plan.controller';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [TypeOrmModule.forFeature([Plan]), SubscriptionModule],
  providers: [PlanService],
  controllers: [PlanController],
  exports: [PlanService], // 🔥 REQUIRED for SubscriptionService
})
export class PlanModule {}