import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

@Controller('webhooks/payments')
export class CustomerWebhookController {
  constructor(private readonly customerService: CustomerService) {}

  @Post(':provider')
  receiveProviderWebhook(
    @Param('provider') provider: string,
    @Headers('provider-signature') signature: string | undefined,
    @Body() body: PaymentWebhookDto,
  ) {
    return this.customerService.handlePaymentWebhook(provider, signature, body);
  }
}
