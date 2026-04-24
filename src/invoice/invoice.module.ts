import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { User } from 'src/user/user.entity';
import { SettingModule } from 'src/settings/setting.module';
import { UserModule } from 'src/user/user.module';
import { UsageModule } from 'src/usage/usage.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, User]),
    SettingModule,
    SubscriptionModule,
    UsageModule,
    UserModule,
  ],
  providers: [InvoiceService],
  controllers: [InvoiceController],
})
export class InvoiceModule {}
