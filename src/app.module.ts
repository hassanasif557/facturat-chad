import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { InvoiceModule } from './invoice/invoice.module';
import { ProductModule } from './product/product.module';
import { SettingModule } from './settings/setting.module';
import { PlanModule } from './plan/plan.module';
import { OrganizationModule } from './organization/organization.module';
import { SubscriptionService } from './subscription/subscription.service';
import { SubscriptionController } from './subscription/subscription.controller';
import { SubscriptionModule } from './subscription/subscription.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    // 1. Load config first
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // 2. Then Initialize TypeORM
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true,
      logging: false,
    }),
    UserModule,
    AuthModule,
    InvoiceModule,
    ProductModule,
    SettingModule,
    PlanModule,
    OrganizationModule,
    SubscriptionModule,
    UsageModule,
  ],
  controllers: [AppController, SubscriptionController],
  providers: [AppService],
})
export class AppModule {}

