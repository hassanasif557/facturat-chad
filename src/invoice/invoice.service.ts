import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { User } from 'src/user/user.entity';
import { InvoiceStatus } from './invoice.entity';
import { VerificationStatus } from 'src/user/user.entity';
import { InvoiceSearchDto } from './dto/search-invoice.dto';
import { SettingService } from 'src/settings/setting.service';
import { UsageService } from 'src/usage/usage.service'; // Assuming this path
import { SubscriptionService } from 'src/subscription/subscription.service'; // Assuming this path

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private repo: Repository<Invoice>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    private settingService: SettingService, // ✅ ADD THIS

    private usageService: UsageService, // ✅ ADD THIS

    private subscriptionService: SubscriptionService, // ✅ ADD THIS
  ) {}

  async create(body: any, files: any[], user: any) {
    // ===============================
    // 👤 LOAD USER + ORG
    // ===============================
    const userEntity = await this.userRepo.findOne({
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!userEntity) {
      throw new NotFoundException('User not found');
    }

    // ===============================
    // 🚫 CHECK SUBSCRIPTION STATUS
    // ===============================
    const subscription =
      await this.subscriptionService.getActiveSubscription(user);

    if (!subscription) {
      throw new ForbiddenException('No active subscription');
    }

    if (subscription.status === 'pending') {
      throw new ForbiddenException('Subscription is pending approval');
    }

    if (subscription.status === 'rejected') {
      throw new ForbiddenException('Subscription was rejected');
    }

    if (new Date(subscription.endDate) < new Date()) {
      throw new ForbiddenException('Subscription expired');
    }

    // ===============================
    // 🚫 CHECK LIMIT
    // ===============================
    await this.checkInvoiceLimit(user);

    // ===============================
    // 📦 PROCESS PRODUCTS
    // ===============================
    const products = JSON.parse(body.products);
    const baseUrl = process.env.BASE_URL;

    const mappedProducts = products.map((p, index) => ({
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      imageUrl: files[index]
        ? `${baseUrl}/uploads/${files[index].filename}`
        : null,
    }));

    const totalAmount = mappedProducts.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0,
    );

    const qrData = `Pay Rs ${totalAmount}`;
    const qrCode = await QRCode.toDataURL(qrData);

    const pdfFileName = await this.generatePDF(body, mappedProducts, qrCode);

    const pdfUrl = `${baseUrl}/uploads/${pdfFileName}`;

    // ===============================
    // 🧾 CREATE INVOICE (FIXED)
    // ===============================
    const invoiceData: DeepPartial<Invoice> = {
      customerName: body.customerName || '',
      date: new Date(body.date).toISOString(),
      totalAmount,
      products: mappedProducts,
      qrCode,
      pdfPath: pdfUrl,
      status: InvoiceStatus.PENDING,

      user: userEntity,
      organization: userEntity.organization ?? null,
    };

    const invoice = this.repo.create(invoiceData);

    const savedInvoice = await this.repo.save(invoice);

    // ===============================
    // ➕ INCREMENT USAGE (CLEAN)
    // ===============================
    await this.usageService.increment(
      userEntity.organization ? undefined : userEntity.id,
      userEntity.organization?.id ?? undefined,
    );

    return savedInvoice;
  }

  async generatePDF(body, products, qrCode) {
    const fileName = `invoice-${Date.now()}.pdf`;

    // ✅ ALWAYS correct root path
    const uploadPath = path.join(process.cwd(), 'uploads');

    // ✅ ensure folder exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const filePath = path.join(uploadPath, fileName);

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(20).text('INVOICE', { align: 'center' });

    doc.moveDown();
    doc.text(`Customer: ${body.customerName}`);
    doc.text(`Date: ${body.date}`);
    doc.text(`Total: Rs ${body.totalAmount}`);

    doc.moveDown();
    doc.text('Products:', { underline: true });

    products.forEach((p, i) => {
      doc.text(
        `${i + 1}. ${p.name} | Qty: ${p.quantity} | Price: Rs ${p.price} | Total: Rs ${p.price * p.quantity}`,
      );
    });

    // QR
    const qrImage = qrCode.replace(/^data:image\/png;base64,/, '');
    const qrBuffer = Buffer.from(qrImage, 'base64');

    doc.moveDown();
    doc.image(qrBuffer, { fit: [100, 100], align: 'center' });

    doc.end();

    return new Promise((resolve) => {
      stream.on('finish', () => resolve(fileName));
    });
  }

  async findMy(user, pagination) {
    const { page = 1, limit = 10 } = pagination;

    const [data, total] = await this.repo.findAndCount({
      where: { user: { id: user.sub } },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findAll(pagination) {
    const { page = 1, limit = 10 } = pagination;

    const [data, total] = await this.repo.findAndCount({
      relations: ['user'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async search(query: InvoiceSearchDto) {
    const {
      id,
      name,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      status,
      page = 1,
      limit = 10,
    } = query;

    const qb = this.repo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.user', 'user');

    if (id) {
      qb.andWhere('invoice.id = :id', { id });
    }

    if (name) {
      qb.andWhere('user.name ILIKE :name', {
        name: `%${name}%`,
      });
    }

    if (startDate && endDate) {
      qb.andWhere('invoice.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    if (minPrice !== undefined && maxPrice !== undefined) {
      qb.andWhere('invoice.totalAmount BETWEEN :min AND :max', {
        min: minPrice,
        max: maxPrice,
      });
    }

    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }

    qb.orderBy('invoice.id', 'DESC');

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async update(id: number, body: any) {
    const invoice = await this.repo.findOne({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // ✅ Merge new data safely
    Object.assign(invoice, body);

    // ✅ Save (better than update)
    const saved = await this.repo.save(invoice);

    return saved;
  }

  async delete(id: number) {
    await this.repo.delete(id);
    return { message: 'Deleted' };
  }

  async updateStatus(id: number, status: string, user: any) {
    const invoice = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // ✅ SECURITY: only owner can update status
    if (invoice.user.id !== user.sub) {
      throw new NotFoundException('You cannot update this invoice');
    }

    invoice.status = status as any;

    return this.repo.save(invoice);
  }

  //Dashboard api
  async getDashboard(user: any, filter: any) {
    // ========================
    // 📅 FILTERED QUERY
    // ========================
    const baseQuery = this.repo
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId: user.sub });

    if (filter.startDate && filter.endDate) {
      baseQuery.andWhere('invoice.date BETWEEN :start AND :end', {
        start: filter.startDate,
        end: filter.endDate,
      });
    }

    // ========================
    // 📊 FILTERED DATA
    // ========================
    const totalInvoices = await baseQuery.getCount();

    const paidQuery = baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'paid' });

    const paidInvoices = await paidQuery.getCount();

    const totalPaidAmount = await paidQuery
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    const pendingQuery = baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'pending' });

    const pendingInvoices = await pendingQuery.getCount();

    const totalPendingAmount = await pendingQuery
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    // ========================
    // 📦 RECENT (FILTERED OR NOT — your choice)
    // ========================
    const recentInvoices = await this.repo.find({
      where: { user: { id: user.sub } },
      order: { id: 'DESC' },
      take: 5,
    });

    // ========================
    // 🔥 ALL-TIME QUERY (NO FILTER)
    // ========================
    const allTimeQuery = this.repo
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId: user.sub });

    // TOTAL INVOICES (ALL TIME)
    const totalInvoicesOfAllTime = await allTimeQuery.getCount();

    // PAID INVOICES (ALL TIME)
    const paidInvoicesOfAllTime = await allTimeQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'paid' })
      .getCount();

    // PENDING INVOICES (ALL TIME)
    const pendingInvoicesOfAllTime = await allTimeQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'pending' })
      .getCount();

    // TOTAL PAID AMOUNT (ALL TIME)
    const totalPaidAmountAllTimeRaw = await allTimeQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'paid' })
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    // TOTAL PENDING AMOUNT (ALL TIME)
    const totalPendingAmountAllTimeRaw = await allTimeQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'pending' })
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    // ========================
    // 📊 USAGE DATA
    // ========================
    const subscription =
      await this.subscriptionService.getActiveSubscription(user);

    let usageData = {};

    if (subscription) {
      const userEntity = await this.userRepo.findOne({
        where: { id: user.sub },
        relations: ['organization'],
      });

      if (!userEntity) {
        throw new NotFoundException('User not found');
      }

      const usage = await this.usageService.getOrCreateUsage(
        userEntity.organization ? undefined : user.sub,
        userEntity.organization?.id,
      );

      usageData = {
        used: usage.invoiceCount,
        limit: subscription.plan.invoiceLimit,
        remaining:
          subscription.plan.invoiceLimit === -1
            ? 'unlimited'
            : subscription.plan.invoiceLimit - usage.invoiceCount,
      };
    }

    return {
      // 🔹 FILTERED
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      totalPaidAmount: Number(totalPaidAmount.sum) || 0,
      totalPendingAmount: Number(totalPendingAmount.sum) || 0,

      // 🔹 ALL TIME (UPDATED)
      totalInvoicesOfAllTime,
      paidInvoicesOfAllTime,
      pendingInvoicesOfAllTime,

      totalPaidAmountOfAllTime: Number(totalPaidAmountAllTimeRaw.sum) || 0,

      totalPendingAmountOfAllTime:
        Number(totalPendingAmountAllTimeRaw.sum) || 0,

      // 🔹 EXTRA
      recentInvoices,
      // 🔹 USAGE
      usage: usageData,
    };
  }

  //Report api
  async getReport(user: any, filter: any) {
    const { startDate, endDate, type = 'monthly' } = filter;

    const start =
      startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const end = endDate || new Date();

    // ========================
    // BASE QUERY
    // ========================
    const baseQuery = this.repo
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId: user.sub })
      .andWhere('invoice.date BETWEEN :start AND :end', {
        start,
        end,
      });

    // ========================
    // TOTALS
    // ========================
    const totalRevenueRaw = await baseQuery
      .clone()
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    const totalRevenue = Number(totalRevenueRaw.sum) || 0;

    // const vat = totalRevenue * 0.18;
    const vat = await this.settingService.getNumber('VAT_RATE');

    const totalInvoices = await baseQuery.getCount();

    const avgPayment = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    // ========================
    // STATUS COUNTS
    // ========================
    const paid = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'paid' })
      .getCount();

    const unpaid = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'unpaid' })
      .getCount();

    const pending = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'pending' })
      .getCount();

    const percentages = {
      paid: totalInvoices ? (paid / totalInvoices) * 100 : 0,
      unpaid: totalInvoices ? (unpaid / totalInvoices) * 100 : 0,
      pending: totalInvoices ? (pending / totalInvoices) * 100 : 0,
    };

    // ========================
    // CHART DATA
    // ========================
    let chartQuery;

    if (type === 'daily') {
      chartQuery = this.repo
        .createQueryBuilder('invoice')
        .select(`TO_CHAR(invoice.date::DATE, 'YYYY-MM-DD')`, 'label')
        .addSelect('SUM(invoice.totalAmount)', 'total')
        .where('invoice.userId = :userId', { userId: user.sub })
        .andWhere('invoice.date BETWEEN :start AND :end', {
          start,
          end,
        })
        .groupBy('label')
        .orderBy('label', 'DESC')
        .limit(10);
    } else if (type === 'weekly') {
      chartQuery = this.repo
        .createQueryBuilder('invoice')
        .select(`TO_CHAR(invoice.date::DATE, 'IYYY-IW')`, 'label')
        .addSelect('SUM(invoice.totalAmount)', 'total')
        .where('invoice.userId = :userId', { userId: user.sub })
        .andWhere('invoice.date BETWEEN :start AND :end', {
          start,
          end,
        })
        .groupBy('label')
        .orderBy('label', 'DESC')
        .limit(10);
    } else {
      // monthly (default)
      chartQuery = this.repo
        .createQueryBuilder('invoice')
        .select(`TO_CHAR(invoice.date::DATE, 'YYYY-MM')`, 'label')
        .addSelect('SUM(invoice.totalAmount)', 'total')
        .where('invoice.userId = :userId', { userId: user.sub })
        .andWhere('invoice.date BETWEEN :start AND :end', {
          start,
          end,
        })
        .groupBy('label')
        .orderBy('label', 'DESC')
        .limit(10);
    }

    const rawChart = await chartQuery.getRawMany();

    // ========================
    // FIX RAW RESPONSE
    // ========================
    const chart = rawChart.map((item) => ({
      label: item.label,
      total: Number(item.total),
    }));

    // ========================
    // FINAL RESPONSE
    // ========================
    return {
      totalRevenue,
      vat,
      totalInvoices,
      avgPayment,

      status: {
        paid,
        unpaid,
        pending,
        percentages,
      },

      chart,
    };
  }

  //Admin Dashboard api
  async getAdminDashboard() {
    // ========================
    // 📦 RECENT INVOICES
    // ========================
    const recentInvoices = await this.repo.find({
      order: { id: 'DESC' },
      take: 6,
      relations: ['user'],
    });

    // ========================
    // 👤 USERS STATS (ALL TIME)
    // ========================
    const totalUsers = await this.userRepo.count();

    const verifiedUsers = await this.userRepo.count({
      where: { verificationStatus: VerificationStatus.VERIFIED },
    });

    const pendingUsers = await this.userRepo.count({
      where: { verificationStatus: VerificationStatus.PENDING },
    });

    const notVerifiedUsers = await this.userRepo.count({
      where: { verificationStatus: VerificationStatus.NOT_VERIFIED },
    });

    // ========================
    // 🧾 INVOICE STATS (ALL TIME)
    // ========================
    const totalInvoices = await this.repo.count();

    const paidInvoices = await this.repo.count({
      where: { status: InvoiceStatus.PAID },
    });

    const pendingInvoices = await this.repo.count({
      where: { status: InvoiceStatus.PENDING },
    });

    const unpaidInvoices = await this.repo.count({
      where: { status: InvoiceStatus.UNPAID },
    });

    const totalRevenueRaw = await this.repo
      .createQueryBuilder('invoice')
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    const totalRevenue = Number(totalRevenueRaw.sum) || 0;

    // ========================
    // 📊 USERS MONTHLY
    // ========================
    const usersMonthlyRaw = await this.userRepo
      .createQueryBuilder('u')
      .select(`TO_CHAR(u."createdAt", 'YYYY-MM')`, 'label')
      .addSelect('COUNT(u.id)', 'total')
      .groupBy(`TO_CHAR(u."createdAt", 'YYYY-MM')`)
      .orderBy('label', 'DESC')
      .limit(12)
      .getRawMany();

    const usersMonthly = usersMonthlyRaw.map((u) => ({
      label: u.label,
      total: Number(u.total),
    }));

    // ========================
    // 💰 REVENUE MONTHLY
    // ========================
    const revenueMonthlyRaw = await this.repo
      .createQueryBuilder('invoice')
      .select(`TO_CHAR(invoice.date::DATE, 'YYYY-MM')`, 'label')
      .addSelect('SUM(invoice.totalAmount)', 'total')
      .groupBy('label')
      .orderBy('label', 'DESC')
      .limit(12)
      .getRawMany();

    const revenueMonthly = revenueMonthlyRaw.map((r) => ({
      label: r.label,
      total: Number(r.total),
    }));

    // ========================
    // 🎯 FINAL RESPONSE
    // ========================
    return {
      // 🔹 RECENT
      recentInvoices,

      // 🔹 USERS
      totalUsers,
      verifiedUsers,
      pendingUsers,
      notVerifiedUsers,

      // 🔹 INVOICES
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      unpaidInvoices,

      // 🔹 REVENUE
      totalRevenue,

      // 🔹 CHARTS
      usersMonthly,
      revenueMonthly,
    };
  }

  //Admin Report api
  async getAdminReport(filter: any) {
    const { startDate, endDate } = filter;

    const baseQuery = this.repo.createQueryBuilder('invoice');

    // ========================
    // 📅 DATE FILTER
    // ========================
    if (startDate && endDate) {
      baseQuery.andWhere('invoice.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    // ========================
    // 💰 TOTAL REVENUE
    // ========================
    const totalRevenueRaw = await baseQuery
      .clone()
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    const totalRevenue = Number(totalRevenueRaw.sum) || 0;

    // ========================
    // 💳 STATUS REVENUE
    // ========================
    const paidRevenueRaw = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'paid' })
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    const unpaidRevenueRaw = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'unpaid' })
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    const pendingRevenueRaw = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'pending' })
      .select('SUM(invoice.totalAmount)', 'sum')
      .getRawOne();

    const paidRevenue = Number(paidRevenueRaw.sum) || 0;
    const unpaidRevenue = Number(unpaidRevenueRaw.sum) || 0;
    const pendingRevenue = Number(pendingRevenueRaw.sum) || 0;

    // ========================
    // 🧮 VAT CALCULATIONS
    // ========================
    const vatRate = await this.settingService.getNumber('VAT_RATE');

    const totalVAT = totalRevenue * vatRate;
    const paidVAT = paidRevenue * vatRate;
    const unpaidVAT = unpaidRevenue * vatRate;
    const pendingVAT = pendingRevenue * vatRate;

    // ========================
    // 📊 INVOICE COUNTS
    // ========================
    const totalInvoices = await baseQuery.getCount();

    const paidInvoices = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'paid' })
      .getCount();

    const unpaidInvoices = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'unpaid' })
      .getCount();

    const pendingInvoices = await baseQuery
      .clone()
      .andWhere('invoice.status = :status', { status: 'pending' })
      .getCount();

    // ========================
    // 📊 MONTHLY REVENUE CHART
    // ========================
    const monthlyRaw = await this.repo
      .createQueryBuilder('invoice')
      .select(`TO_CHAR(invoice.date::DATE, 'YYYY-MM')`, 'label')
      .addSelect('SUM(invoice.totalAmount)', 'total')
      .where(
        startDate && endDate ? 'invoice.date BETWEEN :start AND :end' : '1=1',
        { start: startDate, end: endDate },
      )
      .groupBy('label')
      .orderBy('label', 'ASC')
      .getRawMany();

    const monthlyChart = monthlyRaw.map((item) => ({
      label: item.label,
      total: Number(item.total),
    }));

    // ========================
    // 📊 STATUS REVENUE CHART
    // ========================
    const statusChart = [
      { label: 'paid', total: paidRevenue },
      { label: 'unpaid', total: unpaidRevenue },
      { label: 'pending', total: pendingRevenue },
    ];

    // ========================
    // ✅ FINAL RESPONSE
    // ========================
    return {
      // 💰 REVENUE
      totalRevenue,
      paidRevenue,
      unpaidRevenue,
      pendingRevenue,

      // 🧾 VAT
      totalVAT,
      paidVAT,
      unpaidVAT,
      pendingVAT,

      // 📊 COUNTS
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      pendingInvoices,

      // 📈 CHARTS
      monthlyChart,
      statusChart,
    };
  }

  // CHECK INVOICE LIMIT BEFORE CREATING INVOICE
  async checkInvoiceLimit(user: any) {
    const subscription =
      await this.subscriptionService.getActiveSubscription(user);

    if (!subscription) {
      throw new ForbiddenException('No active subscription');
    }

    // 🚫 NOT APPROVED
    if (subscription.status !== 'active') {
      throw new ForbiddenException('Subscription not approved yet');
    }

    // ⛔ EXPIRED
    if (subscription.endDate && new Date() > subscription.endDate) {
      throw new ForbiddenException('Subscription expired');
    }

    const plan = subscription.plan;

    // ♾️ unlimited plan
    if (plan.invoiceLimit === -1) return;

    const userEntity = await this.userRepo.findOne({
      where: { id: user.sub },
      relations: ['organization'],
    });

    if (!userEntity) {
      throw new NotFoundException('User not found');
    }

    const usage = await this.usageService.getOrCreateUsage(
      userEntity.organization ? undefined : user.sub,
      userEntity.organization?.id,
    );

    if (usage.invoiceCount >= plan.invoiceLimit) {
      throw new ForbiddenException(
        `Invoice limit reached (${plan.invoiceLimit}/month). Upgrade your plan.`,
      );
    }
  }
}
