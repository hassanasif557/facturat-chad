import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { Plan } from 'src/plan/plan.entity';
import { SubscriptionService } from './subscription.service';
import { User } from 'src/user/user.entity';
import { Organization } from 'src/organization/organization.entity';
import { Invoice } from 'src/invoice/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription,
      Plan,
      Organization,
      Invoice,
      User,]),
  ],
  providers: [SubscriptionService],
  exports: [SubscriptionService], // ✅ MUST EXPORT
})
export class SubscriptionModule {}
