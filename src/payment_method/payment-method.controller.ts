import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CreatePaymentMethodDto } from './create-payment-method.dto';
import { UpdatePaymentMethodDto } from './update-payment-method.dto';

@Controller('payment-methods')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class PaymentMethodController {
  constructor(private readonly service: PaymentMethodService) {}

  // ================= CREATE =================
  @Post()
  @Roles('user')
  create(@Body() dto: CreatePaymentMethodDto, @Req() req) {
    return this.service.create(dto, req.user);
  }

  // ================= GET MY =================
  @Get()
  @Roles('user')
  findMy(@Req() req) {
    return this.service.findMy(req.user);
  }

  // ================= GET ONE =================
  @Get(':id')
  @Roles('user')
  findOne(@Param('id') id: number, @Req() req) {
    return this.service.findOne(id, req.user);
  }

  // ================= UPDATE =================
  @Put(':id')
  @Roles('user')
  update(
    @Param('id') id: number,
    @Body() dto: UpdatePaymentMethodDto,
    @Req() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  // ================= DELETE =================
  @Delete(':id')
  @Roles('user')
  delete(@Param('id') id: number, @Req() req) {
    return this.service.delete(id, req.user);
  }
}