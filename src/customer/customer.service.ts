import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { User } from 'src/user/user.entity';
import {
  Invoice,
  InvoicePaymentStatus,
  InvoiceStatus,
} from 'src/invoice/invoice.entity';
import {
  PaymentType,
  Transaction,
  TransactionStatus,
} from 'src/payment/transaction.entity';
import {
  PaymentOption,
  PaymentOptionType,
} from 'src/payment_option/payment-option.entity';
import { Notification } from 'src/notification/notification.entity';
import { InvoiceIssue, InvoiceIssueType } from './entities/invoice-issue.entity';
import { DeviceToken } from './entities/device-token.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CustomerInvoiceQueryDto } from './dto/customer-invoice-query.dto';
import { ReportInvoiceIssueDto } from './dto/report-invoice-issue.dto';
import { CustomerInitiatePaymentDto } from './dto/customer-initiate-payment.dto';
import { CustomerPaymentQueryDto } from './dto/customer-payment-query.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { normalizePhoneE164, maskPhone } from 'src/common/utils/phone.util';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
    @InjectRepository(PaymentOption)
    private paymentOptionRepo: Repository<PaymentOption>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(InvoiceIssue)
    private issueRepo: Repository<InvoiceIssue>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    @InjectRepository(PaymentWebhookEvent)
    private webhookEventRepo: Repository<PaymentWebhookEvent>,
  ) {}

  private success(data: any) {
    return { success: true, data };
  }

  private paginated(data: any[], page: number, limit: number, total: number) {
    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  private async getCustomerUserOrThrow(userId: number) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Resource not found');
    if (user.accountStatus === 'suspended') {
      throw new BadRequestException('Account is suspended');
    }
    return user;
  }

  async getMe(authUser: any) {
    const user = await this.getCustomerUserOrThrow(authUser.sub);
    return this.success({
      id: user.id,
      name: user.name,
      phone: user.phoneNormalized || user.phone,
      phoneVerified: !!user.phoneVerifiedAt,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      profilePictureUrl: user.profilePicture || null,
      language: user.language || 'fr',
    });
  }

  async updateMe(authUser: any, dto: UpdateCustomerProfileDto) {
    const user = await this.getCustomerUserOrThrow(authUser.sub);
    if ((dto as any).phone || (dto as any).role) {
      throw new BadRequestException('Phone and role cannot be updated here');
    }

    Object.assign(user, dto);
    await this.userRepo.save(user);
    return this.success({
      id: user.id,
      name: user.name,
      phone: user.phoneNormalized || user.phone,
      email: user.email,
      language: user.language || 'fr',
      updatedAt: user.updatedAt,
    });
  }

  async getNotificationPreferences(authUser: any) {
    const user = await this.getCustomerUserOrThrow(authUser.sub);
    return this.success({
      pushNewInvoice: user.notificationPreferences?.pushNewInvoice ?? true,
      pushDueReminder: user.notificationPreferences?.pushDueReminder ?? true,
      pushPaymentStatus: user.notificationPreferences?.pushPaymentStatus ?? true,
      emailReceipts: user.notificationPreferences?.emailReceipts ?? true,
    });
  }

  async updateNotificationPreferences(
    authUser: any,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const user = await this.getCustomerUserOrThrow(authUser.sub);
    const current = {
      pushNewInvoice: user.notificationPreferences?.pushNewInvoice ?? true,
      pushDueReminder: user.notificationPreferences?.pushDueReminder ?? true,
      pushPaymentStatus: user.notificationPreferences?.pushPaymentStatus ?? true,
      emailReceipts: user.notificationPreferences?.emailReceipts ?? true,
    };
    user.notificationPreferences = { ...current, ...dto };
    await this.userRepo.save(user);
    return this.success(user.notificationPreferences);
  }

  async getDashboard(authUser: any) {
    const userId = authUser.sub;
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.user', 'merchant')
      .where('i.customerUserId = :userId', { userId })
      .andWhere('i.status != :cancelled', { cancelled: InvoiceStatus.CANCELLED });

    const invoices = await qb.orderBy('i.issuedAt', 'DESC').getMany();

    const unpaid = invoices.filter((i) =>
      [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE].includes(i.status),
    );
    const overdue = invoices.filter((i) => i.status === InvoiceStatus.OVERDUE);
    const outstandingAmount = unpaid.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const paidThisMonth = invoices
      .filter(
        (i) =>
          i.paymentStatus === InvoicePaymentStatus.SUCCESS &&
          i.updatedAt &&
          i.updatedAt >= monthStart,
      )
      .reduce((sum, i) => sum + (i.amountPaid || 0), 0);

    const unreadNotificationCount = await this.notificationRepo.count({
      where: { user: { id: userId }, readAt: IsNull() },
    });

    const recentInvoices = invoices.slice(0, 3).map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      merchant: {
        id: i.user?.id,
        name: i.user?.organization?.name || i.user?.name,
        logoUrl: i.user?.profilePicture || null,
      },
      issuedAt: i.issuedAt || i.createdAt,
      dueAt: i.dueAt || null,
      totalAmount: i.totalAmount,
      balanceDue: i.balanceDue,
      status: i.status,
      paymentStatus: i.paymentStatus,
    }));

    return this.success({
      currency: 'XAF',
      unpaidInvoiceCount: unpaid.length,
      overdueInvoiceCount: overdue.length,
      outstandingAmount,
      paidThisMonthAmount: paidThisMonth,
      unreadNotificationCount,
      recentInvoices,
    });
  }

  async listInvoices(authUser: any, query: CustomerInvoiceQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.user', 'merchant')
      .where('i.customerUserId = :userId', { userId: authUser.sub });

    if (query.search) {
      qb.andWhere(
        '(i.invoiceNumber ILIKE :search OR i.customerName ILIKE :search OR merchant.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.paymentStatus) {
      qb.andWhere('i.paymentStatus = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }
    if (query.status) {
      qb.andWhere('i.status = :status', { status: query.status });
    }
    if (query.merchantId) {
      qb.andWhere('merchant.id = :merchantId', { merchantId: query.merchantId });
    }
    if (query.startDate) {
      qb.andWhere('date(i.issuedAt) >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('date(i.issuedAt) <= :endDate', { endDate: query.endDate });
    }

    const sortField = query.sort?.includes('createdAt') ? 'i.createdAt' : 'i.issuedAt';
    const sortOrder = query.sort?.startsWith('-') ? 'DESC' : 'ASC';
    qb.orderBy(sortField, sortOrder as any);

    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    const data = items.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      merchant: {
        id: i.user?.id,
        name: i.user?.organization?.name || i.user?.name,
        logoUrl: i.user?.profilePicture || null,
      },
      issuedAt: i.issuedAt || i.createdAt,
      dueAt: i.dueAt,
      totalAmount: i.totalAmount,
      amountPaid: i.amountPaid,
      balanceDue: i.balanceDue,
      currency: i.currency || 'XAF',
      status: i.status,
      paymentStatus: i.paymentStatus,
    }));

    return this.paginated(data, page, limit, total);
  }

  async getInvoiceDetail(authUser: any, invoiceId: number) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, customerUser: { id: authUser.sub } },
      relations: ['user', 'customerUser'],
    });
    if (!invoice) throw new NotFoundException('Resource not found');

    const merchant = invoice.user;
    const lines = (invoice.products || []).map((p, idx) => ({
      id: idx + 1,
      name: p.name,
      quantity: p.quantity,
      unitPrice: p.price,
      lineTotal: Number(p.price || 0) * Number(p.quantity || 0),
    }));

    return this.success({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      merchant: {
        id: merchant?.id,
        name: merchant?.organization?.name || merchant?.name,
        phone: merchant?.phone,
        address: null,
        taxNumber: merchant?.tax_number,
        logoUrl: merchant?.profilePicture || null,
      },
      issuedAt: invoice.issuedAt || invoice.createdAt,
      dueAt: invoice.dueAt,
      currency: invoice.currency || 'XAF',
      lines,
      subtotalAmount: invoice.subtotalAmount,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      pdfUrl: `${process.env.BASE_URL}/customer/invoices/${invoice.id}/pdf`,
      verificationUrl: `${process.env.BASE_URL}/verify/${invoice.invoiceNumber || invoice.id}`,
    });
  }

  async getInvoicePdf(authUser: any, invoiceId: number) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, customerUser: { id: authUser.sub } },
    });
    if (!invoice) throw new NotFoundException('Resource not found');
    if (!invoice.pdfPath) throw new NotFoundException('Resource not found');

    return invoice.pdfPath;
  }

  async createInvoiceIssue(authUser: any, invoiceId: number, dto: ReportInvoiceIssueDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, customerUser: { id: authUser.sub } },
    });
    if (!invoice) throw new NotFoundException('Resource not found');

    if (dto.clientRequestId) {
      const existing = await this.issueRepo.findOne({
        where: {
          invoice: { id: invoiceId },
          customerUser: { id: authUser.sub },
          clientRequestId: dto.clientRequestId,
          status: 'open',
        },
      });
      if (existing) {
        return this.success({
          id: existing.id,
          invoiceId,
          status: existing.status,
          createdAt: existing.createdAt,
        });
      }
    }

    const issue = this.issueRepo.create({
      invoice: { id: invoiceId } as Invoice,
      customerUser: { id: authUser.sub } as User,
      type: dto.type as InvoiceIssueType,
      message: dto.message,
      clientRequestId: dto.clientRequestId,
      status: 'open',
    });
    const saved = await this.issueRepo.save(issue);
    return this.success({
      id: saved.id,
      invoiceId,
      status: saved.status,
      createdAt: saved.createdAt,
    });
  }

  async listInvoicePaymentOptions(authUser: any, invoiceId: number) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, customerUser: { id: authUser.sub } },
    });
    if (!invoice) throw new NotFoundException('Resource not found');

    const options = await this.paymentOptionRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
    const data = options.map((o) => ({
      id: o.id,
      type: o.type,
      provider: o.type === PaymentOptionType.MOBILE_MONEY ? 'airtel_money' : null,
      label: o.label,
      isActive: o.isActive,
      minimumAmount: 100,
      maximumAmount: 1000000,
      feeAmount: 0,
      currency: 'XAF',
    }));
    return this.success(data);
  }

  async initiateInvoicePayment(
    authUser: any,
    invoiceId: number,
    idempotencyKey: string | undefined,
    dto: CustomerInitiatePaymentDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, customerUser: { id: authUser.sub } },
      relations: ['user', 'customerUser'],
    });
    if (!invoice) throw new NotFoundException('Resource not found');

    if ([InvoiceStatus.PAID, InvoiceStatus.CANCELLED].includes(invoice.status)) {
      throw new BadRequestException('INVOICE_ALREADY_PAID');
    }

    const existingByKey = await this.txRepo.findOne({
      where: { idempotencyKey, customerUser: { id: authUser.sub } },
      relations: ['invoice'],
    });
    if (existingByKey) {
      return this.success({
        id: existingByKey.id,
        reference: existingByKey.publicReference,
        invoiceId: existingByKey.invoice?.id,
        invoiceNumber: existingByKey.invoice?.invoiceNumber,
        amount: existingByKey.amountInt,
        feeAmount: existingByKey.commission,
        currency: existingByKey.currency,
        provider: existingByKey.provider,
        payerPhoneMasked: maskPhone(existingByKey.customerPhoneNormalized),
        status: existingByKey.status,
        providerAction: {
          type: 'ussd_push',
          message: 'Confirm the request on your phone',
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    }

    const existingPending = await this.txRepo.findOne({
      where: {
        invoice: { id: invoice.id },
        status: TransactionStatus.PENDING,
      },
    });
    if (existingPending) {
      throw new BadRequestException('PAYMENT_ALREADY_PENDING');
    }

    const option = await this.paymentOptionRepo.findOne({
      where: { id: dto.paymentOptionId, isActive: true },
    });
    if (!option) throw new BadRequestException('PAYMENT_OPTION_UNAVAILABLE');

    const normalizedPayerPhone = normalizePhoneE164(dto.payerPhone);
    if (!normalizedPayerPhone) {
      throw new BadRequestException('Phone must use E.164 format');
    }

    const amount = invoice.balanceDue > 0 ? invoice.balanceDue : invoice.totalAmount;
    if (amount <= 0) {
      throw new BadRequestException('INVOICE_ALREADY_PAID');
    }

    const reference = `PAY-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;

    const tx = this.txRepo.create({
      transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      publicReference: reference,
      user: invoice.user,
      customerUser: invoice.customerUser,
      invoice,
      customerName: invoice.customerName,
      amount,
      amountInt: amount,
      currency: 'XAF',
      commission: 0,
      paymentType:
        option.type === PaymentOptionType.CASH
          ? PaymentType.CASH
          : option.type === PaymentOptionType.PAYMENT_LINK
            ? PaymentType.PAYMENT_LINK
            : PaymentType.MOBILE_MONEY,
      provider: dto.provider,
      customerPhone: dto.payerPhone,
      customerPhoneNormalized: normalizedPayerPhone,
      idempotencyKey,
      status:
        option.type === PaymentOptionType.CASH
          ? TransactionStatus.SUCCESS
          : TransactionStatus.PENDING,
      completedAt:
        option.type === PaymentOptionType.CASH ? new Date() : (null as any),
    });

    const saved = await this.txRepo.save(tx);
    if (saved.status === TransactionStatus.SUCCESS) {
      invoice.amountPaid = Math.min(invoice.totalAmount, invoice.amountPaid + amount);
      invoice.balanceDue = Math.max(invoice.totalAmount - invoice.amountPaid, 0);
      invoice.status =
        invoice.balanceDue === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      invoice.paymentStatus = InvoicePaymentStatus.SUCCESS;
      await this.invoiceRepo.save(invoice);
    } else {
      invoice.paymentStatus = InvoicePaymentStatus.PENDING;
      await this.invoiceRepo.save(invoice);
    }

    return this.success({
      id: saved.id,
      reference,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount,
      feeAmount: 0,
      currency: 'XAF',
      provider: dto.provider,
      payerPhoneMasked: maskPhone(normalizedPayerPhone),
      status: saved.status,
      providerAction: {
        type: 'ussd_push',
        message: 'Confirm the request on your phone',
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  }

  async getPayment(authUser: any, paymentId: number) {
    const tx = await this.txRepo.findOne({
      where: { id: paymentId, customerUser: { id: authUser.sub } },
      relations: ['invoice', 'user'],
    });
    if (!tx) throw new NotFoundException('Resource not found');

    return this.success({
      id: tx.id,
      reference: tx.publicReference,
      invoiceId: tx.invoice?.id,
      invoiceNumber: tx.invoice?.invoiceNumber,
      merchantName: tx.user?.organization?.name || tx.user?.name,
      amount: tx.amountInt || tx.amount,
      currency: tx.currency || 'XAF',
      provider: tx.provider,
      status: tx.status,
      failureCode: tx.failureCode || null,
      failureMessage: tx.failureMessage || null,
      completedAt: tx.completedAt || null,
      receiptAvailable: tx.status === TransactionStatus.SUCCESS,
    });
  }

  async listPayments(authUser: any, query: CustomerPaymentQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const qb = this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.invoice', 'invoice')
      .leftJoinAndSelect('tx.user', 'merchant')
      .where('tx.customerUserId = :userId', { userId: authUser.sub });

    if (query.status) qb.andWhere('tx.status = :status', { status: query.status });
    if (query.startDate) qb.andWhere('date(tx.createdAt) >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('date(tx.createdAt) <= :endDate', { endDate: query.endDate });

    qb.orderBy('tx.id', 'DESC');
    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    const data = rows.map((tx) => ({
      id: tx.id,
      reference: tx.publicReference,
      invoiceId: tx.invoice?.id,
      invoiceNumber: tx.invoice?.invoiceNumber,
      merchant: {
        id: tx.user?.id,
        name: tx.user?.organization?.name || tx.user?.name,
        logoUrl: tx.user?.profilePicture || null,
      },
      amount: tx.amountInt || tx.amount,
      currency: tx.currency || 'XAF',
      provider: tx.provider,
      status: tx.status,
      completedAt: tx.completedAt || null,
    }));
    return this.paginated(data, page, limit, total);
  }

  async getPaymentReceiptPath(authUser: any, paymentId: number) {
    const tx = await this.txRepo.findOne({
      where: { id: paymentId, customerUser: { id: authUser.sub } },
      relations: ['invoice', 'user'],
    });
    if (!tx) throw new NotFoundException('Resource not found');
    if (tx.status !== TransactionStatus.SUCCESS) {
      throw new BadRequestException('Receipt is available only for successful payments');
    }

    const folder = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const fileName = `${tx.publicReference || tx.transactionId}.pdf`;
    const filePath = path.join(folder, fileName);

    if (!fs.existsSync(filePath)) {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      doc.fontSize(20).text('PAYMENT RECEIPT');
      doc.moveDown();
      doc.fontSize(12).text(`Reference: ${tx.publicReference || tx.transactionId}`);
      doc.text(`Invoice: ${tx.invoice?.invoiceNumber || tx.invoice?.id}`);
      doc.text(`Merchant: ${tx.user?.organization?.name || tx.user?.name || 'N/A'}`);
      doc.text(`Amount: ${tx.amountInt || tx.amount} XAF`);
      doc.text(`Provider: ${tx.provider || 'N/A'}`);
      doc.text(`Completed At: ${tx.completedAt?.toISOString() || tx.createdAt.toISOString()}`);
      doc.end();
      await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
    }

    return filePath;
  }

  async saveDeviceToken(authUser: any, body: any) {
    if (!body?.token || !body?.deviceId) {
      throw new BadRequestException('token and deviceId are required');
    }
    const entity = await this.deviceTokenRepo.findOne({
      where: { user: { id: authUser.sub }, deviceId: body.deviceId },
      relations: ['user'],
    });

    if (entity) {
      entity.token = body.token;
      entity.platform = body.platform || entity.platform;
      entity.appVersion = body.appVersion || entity.appVersion;
      await this.deviceTokenRepo.save(entity);
    } else {
      await this.deviceTokenRepo.save(
        this.deviceTokenRepo.create({
          user: { id: authUser.sub } as User,
          deviceId: body.deviceId,
          token: body.token,
          platform: body.platform || 'android',
          appVersion: body.appVersion || null,
        }),
      );
    }

    const user = await this.userRepo.findOneBy({ id: authUser.sub });
    if (user) {
      user.fcmToken = body.token;
      await this.userRepo.save(user);
    }

    return this.success({ registered: true });
  }

  async listNotifications(authUser: any, query: ListNotificationsQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .leftJoin('n.user', 'u')
      .where('u.id = :userId', { userId: authUser.sub });

    if (query.unreadOnly) qb.andWhere('n.readAt is null');
    qb.orderBy('n.createdAt', 'DESC');

    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    const data = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.message,
      data: n.dataJson || {},
      readAt: n.readAt,
      createdAt: n.createdAt,
    }));
    return this.paginated(data, page, limit, total);
  }

  async markNotificationRead(authUser: any, notificationId: number) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, user: { id: authUser.sub } },
      relations: ['user'],
    });
    if (!notification) throw new NotFoundException('Resource not found');
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }
  }

  async markAllNotificationsRead(authUser: any) {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where(`"userId" = :userId`, { userId: authUser.sub })
      .andWhere(`"readAt" is null`)
      .execute();
  }

  async handlePaymentWebhook(
    provider: string,
    signature: string | undefined,
    dto: PaymentWebhookDto,
  ) {
    const providerSecret =
      process.env[`PAYMENT_WEBHOOK_SECRET_${provider.toUpperCase()}`] ||
      process.env.PAYMENT_WEBHOOK_SECRET;
    if (!providerSecret || !signature || signature !== providerSecret) {
      throw new BadRequestException('Invalid provider signature');
    }

    const existing = await this.webhookEventRepo.findOne({
      where: { provider, providerEventId: dto.eventId },
    });
    if (existing?.processed) return { received: true };

    const event = existing
      ? existing
      : this.webhookEventRepo.create({
          provider,
          providerEventId: dto.eventId,
          providerTransactionId: dto.transactionId,
          merchantReference: dto.merchantReference,
          payload: dto as any,
          signatureValid: true,
          processed: false,
        });
    await this.webhookEventRepo.save(event);

    const tx = await this.txRepo.findOne({
      where: [{ publicReference: dto.merchantReference }, { transactionId: dto.merchantReference }],
      relations: ['invoice', 'customerUser', 'user'],
    });
    if (!tx) {
      event.processed = true;
      event.processedAt = new Date();
      await this.webhookEventRepo.save(event);
      return { received: true };
    }

    if (tx.status === TransactionStatus.SUCCESS) {
      event.processed = true;
      event.processedAt = new Date();
      await this.webhookEventRepo.save(event);
      return { received: true };
    }

    const success = dto.status.toUpperCase() === 'SUCCESS';
    if (success) {
      tx.status = TransactionStatus.SUCCESS;
      tx.completedAt = new Date(dto.occurredAt);
      tx.providerTransactionId = dto.transactionId;
      await this.txRepo.save(tx);

      if (tx.invoice) {
        tx.invoice.amountPaid = Math.min(tx.invoice.totalAmount, tx.invoice.amountPaid + (tx.amountInt || tx.amount));
        tx.invoice.balanceDue = Math.max(tx.invoice.totalAmount - tx.invoice.amountPaid, 0);
        tx.invoice.paymentStatus = InvoicePaymentStatus.SUCCESS;
        tx.invoice.status =
          tx.invoice.balanceDue === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
        await this.invoiceRepo.save(tx.invoice);
      }
    } else {
      tx.status = TransactionStatus.FAILED;
      tx.failureCode = dto.status;
      tx.failureMessage = 'Provider reported failed payment';
      await this.txRepo.save(tx);
      if (tx.invoice && tx.invoice.paymentStatus !== InvoicePaymentStatus.SUCCESS) {
        tx.invoice.paymentStatus = InvoicePaymentStatus.FAILED;
        await this.invoiceRepo.save(tx.invoice);
      }
    }

    event.processed = true;
    event.processedAt = new Date();
    await this.webhookEventRepo.save(event);
    return { received: true };
  }
}
