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
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CreateOrganizationDto } from './create-organization.dto';

@Controller('organization')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private service: OrganizationService) {}

  @Post()
  @Roles('user')
  create(@Body() dto: CreateOrganizationDto, @Req() req) {
    return this.service.createOrganization(dto.name, req.user);
  }

  @Post('invite')
  @Roles('user')
  invite(@Body('identifier') identifier: string, @Req() req) {
    return this.service.inviteUser(identifier, req.user);
  }

  @Put('invite/:id/accept')
  @Roles('user')
  accept(@Param('id') id: number, @Req() req) {
    return this.service.acceptInvite(id, req.user);
  }

  @Put('invite/:id/reject')
  @Roles('user')
  reject(@Param('id') id: number, @Req() req) {
    return this.service.rejectInvite(id, req.user);
  }

  @Get('my-invites')
  @Roles('user')
  myInvites(@Req() req) {
    return this.service.getMyInvites(req.user);
  }

  @Delete('remove/:userId')
  @Roles('user')
  remove(@Param('userId') userId: number, @Req() req) {
    return this.service.removeUser(userId, req.user);
  }

  @Get('users')
  @Roles('user')
  getUsers(@Req() req) {
    return this.service.getOrganizationUsers(req.user);
  }
}
