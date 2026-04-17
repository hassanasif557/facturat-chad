import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('invoices')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private service: InvoiceService) {}

  // ✅ SINGLE API
  @Post()
  @Roles('user', 'admin')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          cb(null, Date.now() + '-' + file.originalname);
        },
      }),
    }),
  )
  create(@UploadedFiles() files, @Body() body, @Req() req) {
    return this.service.create(body, files, req.user);
  }

  @Get('my')
  @Roles('user')
  my(@Req() req) {
    return this.service.findMy(req.user);
  }

  @Get()
  @Roles('admin')
  all() {
    return this.service.findAll();
  }

  @Get('search')
  @Roles('admin')
  search(@Query('id') id?: number, @Query('name') name?: string) {
    return this.service.search(id, name);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: number, @Body() body) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: number) {
    return this.service.delete(id);
  }
}