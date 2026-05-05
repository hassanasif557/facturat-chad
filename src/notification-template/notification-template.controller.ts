import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { NotificationTemplateService } from "./notification-template.service";
import { CreateNotificationTemplateDto } from "../notification-template/create-notification-template.dto";
import { Roles } from "src/auth/decorators/roles.decorator";

@Controller('notification-templates')
export class NotificationTemplateController {
  constructor(private service: NotificationTemplateService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateNotificationTemplateDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: number, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: number) {
    return this.service.delete(id);
  }
}