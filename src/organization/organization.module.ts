import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { User } from 'src/user/user.entity';
import { OrganizationInvite } from './organization-invite.entity';
import { Organization } from './organization.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
  TypeOrmModule.forFeature([
    Organization,
    OrganizationInvite,
    User,
  ]),
  SubscriptionModule,
],
  controllers: [OrganizationController],
  providers: [OrganizationService]
})
export class OrganizationModule {}
