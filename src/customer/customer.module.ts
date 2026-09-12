import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { User } from 'src/user/user.entity';
import { Invoice } from 'src/invoice/invoice.entity';
import { Transaction } from 'src/payment/transaction.entity';
import { PaymentOption } from 'src/payment_option/payment-option.entity';
import { Notification } from 'src/notification/notification.entity';
import { InvoiceIssue } from './entities/invoice-issue.entity';
import { DeviceToken } from './entities/device-token.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { CustomerWebhookController } from './customer-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Invoice,
      Transaction,
      PaymentOption,
      Notification,
      InvoiceIssue,
      DeviceToken,
      PaymentWebhookEvent,
    ]),
  ],
  providers: [CustomerService],
  controllers: [CustomerController, CustomerWebhookController],
  exports: [CustomerService],
})
export class CustomerModule {}
