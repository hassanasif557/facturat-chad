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
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { InvoiceDashboardFilterDto } from './dto/invoice-dashboard-filter.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ReportFilterDto } from './dto/report-filter.dto';
import { InvoiceSearchDto } from './dto/search-invoice.dto';

@Controller('invoices')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private service: InvoiceService) {}

  // ✅ SINGLE API
  @Post('create')
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
  my(@Req() req, @Query() pagination: PaginationDto) {
    return this.service.findMy(req.user, pagination);
  }

  @Get()
  @Roles('admin')
  all(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get('search')
@Roles('admin')
search(@Query() query: InvoiceSearchDto) {
  return this.service.search(query);
}

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: number, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: number) {
    return this.service.delete(id);
  }

  // ✅ USER: UPDATE OWN INVOICE STATUS
  @Put(':id/status')
  @Roles('user')
  updateStatus(
    @Param('id') id: number,
    @Body() body: UpdateInvoiceStatusDto,
    @Req() req,
  ) {
    return this.service.updateStatus(id, body.status, req.user);
  }

  // ✅ Dashboard api
  @Get('dashboard')
  @Roles('user')
  dashboard(@Req() req, @Query() filter: InvoiceDashboardFilterDto) {
    return this.service.getDashboard(req.user, filter);
  }

  // ✅ Report api
  @Get('report')
  @Roles('user')
  report(@Req() req, @Query() filter: ReportFilterDto) {
    return this.service.getReport(req.user, filter);
  }

  @Get('admin/dashboard')
  @Roles('admin')
  adminDashboard() {
    return this.service.getAdminDashboard();
  }
}
