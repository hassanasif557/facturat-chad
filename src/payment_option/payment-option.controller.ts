import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PaymentOptionService } from './payment-option.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { CreatePaymentOptionDto } from './create-payment-option.dto';

@Controller('payment-options')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class PaymentOptionController {
  constructor(private service: PaymentOptionService) {}

  // ================= ADMIN =================

  @Post()
  @Roles('admin')
  create(@Body() dto: CreatePaymentOptionDto) {
    return this.service.create(dto);
  }

  @Get('admin')
  @Roles('admin')
  getAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: number, @Body() dto: CreatePaymentOptionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: number) {
    return this.service.delete(id);
  }

  // ================= USER =================

  @Get()
  @Roles('user')
  getActive() {
    return this.service.findActive();
  }
}