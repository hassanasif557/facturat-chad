import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CustomerService } from './customer.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CustomerInvoiceQueryDto } from './dto/customer-invoice-query.dto';
import { ReportInvoiceIssueDto } from './dto/report-invoice-issue.dto';
import { CustomerInitiatePaymentDto } from './dto/customer-initiate-payment.dto';
import { CustomerPaymentQueryDto } from './dto/customer-payment-query.dto';
import type { Response } from 'express';
import { createReadStream } from 'fs';

@Controller('customer')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.customerService.getMe(req.user);
  }

  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateCustomerProfileDto) {
    return this.customerService.updateMe(req.user, dto);
  }

  @Get('me/notification-preferences')
  getNotificationPreferences(@Req() req: any) {
    return this.customerService.getNotificationPreferences(req.user);
  }

  @Patch('me/notification-preferences')
  updateNotificationPreferences(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.customerService.updateNotificationPreferences(req.user, dto);
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.customerService.getDashboard(req.user);
  }

  @Get('invoices')
  listInvoices(@Req() req: any, @Query() query: CustomerInvoiceQueryDto) {
    return this.customerService.listInvoices(req.user, query);
  }

  @Get('invoices/:invoiceId')
  getInvoiceDetail(@Req() req: any, @Param('invoiceId') invoiceId: number) {
    return this.customerService.getInvoiceDetail(req.user, Number(invoiceId));
  }

  @Get('invoices/:invoiceId/pdf')
  async getInvoicePdf(
    @Req() req: any,
    @Param('invoiceId') invoiceId: number,
    @Res() res: Response,
  ) {
    const fileUrl = await this.customerService.getInvoicePdf(
      req.user,
      Number(invoiceId),
    );
    const localPath = fileUrl.replace(`${process.env.BASE_URL}/`, '');
    const absolutePath = `${process.cwd()}/${localPath}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${invoiceId}.pdf"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    createReadStream(absolutePath).pipe(res);
  }

  @Post('invoices/:invoiceId/issues')
  reportInvoiceIssue(
    @Req() req: any,
    @Param('invoiceId') invoiceId: number,
    @Body() dto: ReportInvoiceIssueDto,
  ) {
    return this.customerService.createInvoiceIssue(
      req.user,
      Number(invoiceId),
      dto,
    );
  }

  @Get('invoices/:invoiceId/payment-options')
  getInvoicePaymentOptions(
    @Req() req: any,
    @Param('invoiceId') invoiceId: number,
  ) {
    return this.customerService.listInvoicePaymentOptions(
      req.user,
      Number(invoiceId),
    );
  }

  @Post('invoices/:invoiceId/payments')
  @HttpCode(202)
  initiateInvoicePayment(
    @Req() req: any,
    @Param('invoiceId') invoiceId: number,
    @Body() dto: CustomerInitiatePaymentDto,
  ) {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    return this.customerService.initiateInvoicePayment(
      req.user,
      Number(invoiceId),
      idempotencyKey,
      dto,
    );
  }

  @Get('payments/:paymentId')
  getPayment(@Req() req: any, @Param('paymentId') paymentId: number) {
    return this.customerService.getPayment(req.user, Number(paymentId));
  }

  @Get('payments')
  listPayments(@Req() req: any, @Query() query: CustomerPaymentQueryDto) {
    return this.customerService.listPayments(req.user, query);
  }

  @Get('payments/:paymentId/receipt')
  @Header('Cache-Control', 'private, max-age=300')
  async getPaymentReceipt(
    @Req() req: any,
    @Param('paymentId') paymentId: number,
    @Res() res: Response,
  ) {
    const filePath = await this.customerService.getPaymentReceiptPath(
      req.user,
      Number(paymentId),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payment-${paymentId}.pdf"`,
    );
    createReadStream(filePath).pipe(res);
  }
}
