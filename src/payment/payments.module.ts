import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

import { Transaction } from './transaction.entity';
import { PaymentMethod } from 'src/payment_method/payment-method.entity';
import { Invoice } from 'src/invoice/invoice.entity';
import { User } from 'src/user/user.entity';
import { PaymentOption } from 'src/payment_option/payment-option.entity';
import { PaymentOptionModule } from 'src/payment_option/payment-option.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Invoice, PaymentMethod, User, PaymentOption]),
    PaymentOptionModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}