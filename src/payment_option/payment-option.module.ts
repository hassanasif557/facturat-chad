import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOption } from './payment-option.entity';
import { PaymentOptionService } from './payment-option.service';
import { PaymentOptionController } from './payment-option.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentOption])],
  providers: [PaymentOptionService],
  controllers: [PaymentOptionController],
  exports: [PaymentOptionService, TypeOrmModule],
})
export class PaymentOptionModule {}