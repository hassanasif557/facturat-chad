import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UsageService } from './usage.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('usage')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class UsageController {
  constructor(private usageService: UsageService) {}

  // ✅ USER DASHBOARD
  @Get()
  @Roles('user')
  getMyUsage(@Req() req) {
    return this.usageService.getMyUsage(req.user);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('reset')
  resetUsage(@Req() req) {
    return this.usageService.resetForAdmin(req.user);
  }

  @Post('reset/user/:userId')
  @Roles('admin')
  resetUser(@Param('userId') userId: number) {
    return this.usageService.resetUserUsage(userId);
  }

  @Post('reset/org/:orgId')
  @Roles('admin')
  resetOrg(@Param('orgId') orgId: number) {
    return this.usageService.resetOrgUsage(orgId);
  }

  @Post('reset/all')
  @Roles('admin')
  resetAll() {
    return this.usageService.resetAllUsage();
  }
}
