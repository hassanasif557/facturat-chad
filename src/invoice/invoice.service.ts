import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private repo: Repository<Invoice>,
  ) {}

  async create(body: any, files: any[], user: any) {
    const products = JSON.parse(body.products);

    // map images to products
    const mappedProducts = products.map((p, index) => ({
      name: p.name,
      price: p.price,
      quantity: p.quantity, // ✅ NEW
      imageUrl: files[index]
        ? `http://localhost:3000/uploads/${files[index].filename}`
        : null,
    }));

    //calculate total amount
    const totalAmount = mappedProducts.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0,
    );
    body.totalAmount = totalAmount.toString();

    // QR
    const qrData = `Pay Rs ${body.totalAmount}`;
    const qrCode = await QRCode.toDataURL(qrData);

    // PDF
    const pdfPath = await this.generatePDF(
      body,
      mappedProducts,
      qrCode,
    );

    const invoice = this.repo.create({
      customerName: body.customerName || '',
      date: new Date(body.date),
      totalAmount: parseFloat(body.totalAmount),
      products: mappedProducts,
      qrCode,
      pdfPath,
      status: 'pending', // ✅ ADD THIS
      user: { id: user.sub },
    } as any);

    return this.repo.save(invoice);
  }

  async generatePDF(body, products, qrCode) {
    const fileName = `invoice-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../../uploads', fileName);

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // ===== TEMPLATE =====
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
      stream.on('finish', () => resolve(filePath));
    });
  }

  async findMy(user) {
    return this.repo.find({
      where: { user: { id: user.sub } },
    });
  }

  async findAll() {
    return this.repo.find({ relations: ['user'] });
  }

  async search(id?: number, name?: string) {
    const query = this.repo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.user', 'user');

    if (id) {
      query.andWhere('invoice.id = :id', { id });
    }

    if (name) {
      query.andWhere('user.name ILIKE :name', {
        name: `%${name}%`,
      });
    }

    return query.getMany();
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
  const query = this.repo
    .createQueryBuilder('invoice')
    .where('invoice.userId = :userId', { userId: user.sub });

  // ✅ DATE FILTER
  if (filter.startDate && filter.endDate) {
    query.andWhere(
      'invoice.date BETWEEN :start AND :end',
      {
        start: filter.startDate,
        end: filter.endDate,
      },
    );
  }

  // ========================
  // 📊 TOTAL INVOICES
  // ========================
  const totalInvoices = await query.getCount();

  // ========================
  // 💰 PAID INVOICES
  // ========================
  const paidQuery = query.clone()
    .andWhere('invoice.status = :status', { status: 'paid' });

  const paidInvoices = await paidQuery.getCount();

  const totalPaidAmount = await paidQuery
    .select('SUM(invoice.totalAmount)', 'sum')
    .getRawOne();

  // ========================
  // 🕒 PENDING INVOICES
  // ========================
  const pendingQuery = query.clone()
    .andWhere('invoice.status = :status', { status: 'pending' });

  const pendingInvoices = await pendingQuery.getCount();

  const totalPendingAmount = await pendingQuery
    .select('SUM(invoice.totalAmount)', 'sum')
    .getRawOne();

  // ========================
  // 📦 RECENT 5 INVOICES
  // ========================
  const recentInvoices = await this.repo.find({
    where: {
      user: { id: user.sub },
    },
    order: {
      id: 'DESC',
    },
    take: 5,
  });

  return {
    totalInvoices,
    paidInvoices,
    pendingInvoices,
    totalPaidAmount: Number(totalPaidAmount.sum) || 0,
    totalPendingAmount: Number(totalPendingAmount.sum) || 0,
    recentInvoices,
  };
}
}