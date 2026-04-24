import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PlanService } from './plan.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { CreatePlanDto } from './create-plan.dto';
import { UpdatePlanDto } from './update-plan.dto';

@Controller('plans')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class PlanController {
  constructor(private service: PlanService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreatePlanDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('admin', 'user')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: number, @Body() dto: UpdatePlanDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: number) {
    return this.service.delete(id);
  }
}