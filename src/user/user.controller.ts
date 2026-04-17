import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ================= ADMIN ONLY =================

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async createUser(@Body() body: Partial<User>) {
    return this.userService.create(body);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('search')
  async searchUsers(
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('verificationStatus') verificationStatus?: string,
  ) {
    return this.userService.search({
      name,
      email,
      verificationStatus,
    });
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  async updateUser(
    @Param('id') id: number,
    @Body() body: Partial<User>,
  ) {
    return this.userService.update(id, body);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async deleteUser(@Param('id') id: number) {
    return this.userService.delete(id);
  }

  // ================= USER + ADMIN (SELF PROFILE) =================

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  @Get('me')
  async getMe(@Req() req) {
    return this.userService.findMe(req.user);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  @Put('me')
  async updateMe(@Req() req, @Body() body: Partial<User>) {
    return this.userService.updateMe(req.user, body);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  @Delete('me')
  async deleteMe(@Req() req) {
    return this.userService.deleteMe(req.user);
  }
}