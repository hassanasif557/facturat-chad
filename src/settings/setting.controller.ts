import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SettingService } from './setting.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('settings')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class SettingController {
  constructor(private service: SettingService) {}

  // ✅ GET ALL SETTINGS
  @Get()
  @Roles('admin')
  getAll() {
    return this.service.getAll();
  }

  // ✅ CREATE / UPDATE SETTING
  @Post()
  @Roles('admin')
  set(@Body() body: { key: string; value: string }) {
    return this.service.set(body.key, body.value);
  }
}