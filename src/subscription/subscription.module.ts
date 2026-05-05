import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { Plan } from 'src/plan/plan.entity';
import { SubscriptionService } from './subscription.service';
import { User } from 'src/user/user.entity';
import { Organization } from 'src/organization/organization.entity';
import { Invoice } from 'src/invoice/invoice.entity';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription,
      Plan,
      Organization,
      Invoice,
      User,]),
      NotificationModule,
  ],
  providers: [SubscriptionService],
  exports: [SubscriptionService], // ✅ MUST EXPORT
})
export class SubscriptionModule {}
