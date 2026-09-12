import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Plan } from 'src/plan/plan.entity';
import { Subscription } from 'src/subscription/subscription.entity';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { NotificationModule } from 'src/notification/notification.module';
import { DeviceToken } from 'src/customer/entities/device-token.entity';

@Module({
    imports: [ TypeOrmModule.forFeature([
        User,
      Subscription,
      Plan,
      DeviceToken,
    ]),SubscriptionModule, NotificationModule],
    providers: [UserService],
    controllers: [UserController],
    exports: [UserService]
})
export class UserModule {}