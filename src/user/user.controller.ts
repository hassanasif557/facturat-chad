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
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ================= ADMIN =================

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  createUser(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.userService.findOne(id);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  updateUser(
    @Param('id') id: number,
    @Body() body: UpdateUserDto,
  ) {
    return this.userService.update(id, body);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id/verification')
  updateVerification(
    @Param('id') id: number,
    @Body() body: UpdateVerificationDto,
  ) {
    console.log('Received request to update verification status for user', id, 'to', body.verificationStatus);
    return this.userService.updateVerificationStatus(
      id,
      body.verificationStatus,
    );
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  deleteUser(@Param('id') id: number) {
    return this.userService.delete(id);
  }

  // ================= USER SELF =================

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  @Get('me')
  getMe(@Req() req) {
    return this.userService.findMe(req.user);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  @Put('me')
  updateMe(@Req() req, @Body() body: UpdateProfileDto) {
    return this.userService.updateMe(req.user, body);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  @Delete('me')
  deleteMe(@Req() req) {
    return this.userService.deleteMe(req.user);
  }
}