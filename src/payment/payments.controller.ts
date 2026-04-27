import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
  Put,
  Get,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { TransactionSearchDto } from './transaction-search.dto';

@Controller('payments')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  // ================= USER =================

  // 📲 Initiate Mobile Money Payment
  @Post('initiate')
  @Roles('user')
  initiate(@Req() req, @Body() body: any) {
    return this.service.initiatePayment(req.user, body);
  }

  // 📄 Get My Transactions
  // USER
  @Get('my')
  @Roles('user')
  getMyTransactions(@Req() req, @Query() query: TransactionSearchDto) {
    return this.service.getMyTransactions(req.user, query);
  }

  // ================= ADMIN =================

  // 🔔 Mock Webhook (simulate provider response)
  @Put('mock-webhook/:transactionId')
  @Roles('admin')
  webhook(
    @Param('transactionId') transactionId: string,
    @Body('status') status: 'SUCCESS' | 'FAILED',
  ) {
    return this.service.mockWebhook(transactionId, status);
  }

  // 📊 Get All Transactions (admin)
  // ADMIN
  @Get()
  @Roles('admin')
  getAll(@Query() query: TransactionSearchDto) {
    return this.service.getAllTransactions(query);
  }
}
