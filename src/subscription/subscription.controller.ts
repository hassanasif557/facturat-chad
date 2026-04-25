import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Put,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SubscribeDto } from './subscribe.dto';

@Controller('subscription')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class SubscriptionController {
  constructor(private service: SubscriptionService) {}

  @Post()
  @Roles('user')
  subscribe(@Body() dto: SubscribeDto, @Req() req) {
    return this.service.subscribe(req.user, dto.planId);
  }

  @Get('me')
  @Roles('user')
  getMySubscription(@Req() req) {
    return this.service.getActiveSubscription(req.user);
  }

  // @Get('usage')
  // @Roles('user')
  // getUsage(@Req() req) {
  //   return this.service.getUsage(req.user);
  // }

  // ================= ADMIN =================

  @Put(':id/approve')
  @Roles('admin')
  approve(@Param('id') id: number) {
    return this.service.approveSubscription(id);
  }

  @Put(':id/reject')
  @Roles('admin')
  reject(@Param('id') id: number) {
    return this.service.rejectSubscription(id);
  }

  @Get('requests')
  @Roles('admin')
  getRequests() {
    return this.service.getPendingRequests();
  }

  @Get('all')
  @Roles('admin')
  getAll(@Query() query: any) {
    return this.service.getAllSubscriptions(query);
  }

  @Get('stats')
  @Roles('admin')
  getStats() {
    return this.service.getSubscriptionStats();
  }
}
