import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Delete,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { OrganizationService } from './organization.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CreateOrganizationDto } from './create-organization.dto';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('organization')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private service: OrganizationService) {}

  // ==============================
  // CREATE ORGANIZATION
  // ==============================
  @Post()
  @Roles('user')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: diskStorage({
        destination: './uploads/organizations',

        filename: (req, file, cb) => {
          const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, uniqueName + extname(file.originalname));
        },
      }),
    }),
  )
  create(
    @Body() dto: CreateOrganizationDto,
    @Req() req,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.createOrganization(dto, req.user, file);
  }

  // ==============================
  // INVITE USER
  // ==============================
  @Post('invite')
  @Roles('user')
  invite(@Body('identifier') identifier: string, @Req() req) {
    return this.service.inviteUser(identifier, req.user);
  }

  // ==============================
  // ACCEPT INVITE
  // ==============================
  @Put('invite/:id/accept')
  @Roles('user')
  accept(@Param('id') id: number, @Req() req) {
    return this.service.acceptInvite(id, req.user);
  }

  // ==============================
  // REJECT INVITE
  // ==============================
  @Put('invite/:id/reject')
  @Roles('user')
  reject(@Param('id') id: number, @Req() req) {
    return this.service.rejectInvite(id, req.user);
  }

  // ==============================
  // MY INVITES
  // ==============================
  @Get('my-invites')
  @Roles('user')
  myInvites(@Req() req) {
    return this.service.getMyInvites(req.user);
  }

  // ==============================
  // REMOVE USER
  // ==============================
  @Delete('remove/:userId')
  @Roles('user')
  remove(@Param('userId') userId: number, @Req() req) {
    return this.service.removeUser(userId, req.user);
  }

  // ==============================
  // GET ORG USERS
  // ==============================
  @Get('users')
  @Roles('user')
  getUsers(@Req() req) {
    return this.service.getOrganizationUsers(req.user);
  }

  // ==============================
  // MY ORGANIZATION DETAIL
  // ==============================
  @Get('my/details')
  @Roles('user')
  getMyOrganization(@Req() req) {
    return this.service.getMyOrganizationDetails(req.user);
  }

  // ==============================
  // BASIC LIST
  // ==============================
  @Get()
  getAll() {
    return this.service.getAllOrganizations();
  }

  // ==============================
  // STATS
  // ==============================
  @Get('stats')
  getStats() {
    return this.service.getOrganizationStats();
  }

  // ==============================
  // DETAIL BY ID
  // ==============================
  @Get(':id')
  getById(@Param('id') id: number) {
    return this.service.getOrganizationById(+id);
  }
}
