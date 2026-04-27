import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Transaction,
  TransactionStatus,
  PaymentType, // ✅ FIXED
} from './transaction.entity';

import { Invoice, InvoiceStatus } from 'src/invoice/invoice.entity';
import { User } from 'src/user/user.entity';
import { InitiatePaymentDto } from './initiate-payment.dto';

// ✅ ENTITY (different name now)
import { PaymentMethod } from 'src/payment_method/payment-method.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(PaymentMethod)
    private paymentMethodRepo: Repository<PaymentMethod>,
  ) {}

  // ==============================
  // 🚀 INITIATE PAYMENT (MOCK)
  // ==============================
  async initiatePayment(user: any, dto: InitiatePaymentDto) {
    // 📄 GET INVOICE
    const invoice = await this.invoiceRepo.findOne({
      where: { id: dto.invoice_id },
      relations: ['user', 'organization'],
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    // 🔐 OWNER CHECK
    if (invoice.user.id !== user.sub) {
      throw new ForbiddenException('Not your invoice');
    }

    // ❌ already paid
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice already paid');
    }

    // ===============================
    // 💳 VALIDATE PAYMENT METHOD
    // ===============================
    const method = await this.paymentMethodRepo.findOne({
      where: {
        id: dto.paymentMethodId,
        user: { id: user.sub },
      },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    if (!method.isActive) {
      throw new ForbiddenException('Payment method is inactive');
    }

    if (method.provider !== dto.provider) {
      throw new ForbiddenException(
        `Selected method is ${method.provider}, not ${dto.provider}`,
      );
    }

    // ===============================
    // 💰 COMMISSION
    // ===============================
    const commission = invoice.totalAmount * 0.02;

    // ❌ already in progress
    const existingTx = await this.txRepo.findOne({
      where: {
        invoice: { id: invoice.id },
        status: TransactionStatus.PENDING,
      },
    });

    if (existingTx) {
      throw new BadRequestException('Payment already in progress');
    }

    // ===============================
    // 🧾 CREATE TRANSACTION
    // ===============================
    const transaction = this.txRepo.create({
      transactionId: 'TXN-' + Date.now(),
      user: invoice.user,
      invoice,
      customerName: invoice.customerName,
      amount: invoice.totalAmount,
      commission,

      // ✅ FIXED
      paymentType: PaymentType.MOBILE_MONEY,

      provider: method.provider,
      customerPhone: dto.customer_phone,
      status: TransactionStatus.PENDING,
    });

    const saved = await this.txRepo.save(transaction);

    return {
      message: 'Payment initiated (mock)',
      transactionId: saved.transactionId,
      status: saved.status,
    };
  }

  // ==============================
  // 🔔 MOCK WEBHOOK (ADMIN)
  // ==============================
  async mockWebhook(transactionId: string, status: 'SUCCESS' | 'FAILED') {
    const tx = await this.txRepo.findOne({
      where: { transactionId },
      relations: ['invoice', 'user'],
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Already processed');
    }

    // ✅ update transaction
    tx.status =
      status === 'SUCCESS'
        ? TransactionStatus.SUCCESS
        : TransactionStatus.FAILED;

    await this.txRepo.save(tx);

    // ✅ update invoice
    if (status === 'SUCCESS') {
      tx.invoice.status = InvoiceStatus.PAID;
      await this.invoiceRepo.save(tx.invoice);
    }

    return {
      message: 'Webhook processed',
      transaction: tx,
    };
  }

  // ==================================================
  // 👤 USER: GET MY TRANSACTIONS (WITH FILTERS)
  // ==================================================
  async getMyTransactions(user: any, query: any) {
    const {
      page = 1,
      limit = 10,
      status,
      paymentType,
      provider,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      invoiceId,
      customerName,
    } = query;

    const qb = this.txRepo.createQueryBuilder('tx');

    qb.leftJoinAndSelect('tx.invoice', 'invoice');

    qb.where('tx.userId = :userId', { userId: user.sub });

    // ================= FILTERS =================

    if (status) {
      qb.andWhere('tx.status = :status', { status });
    }

    if (paymentType) {
      qb.andWhere('tx.paymentType = :paymentType', { paymentType });
    }

    if (provider) {
      qb.andWhere('tx.provider = :provider', { provider });
    }

    if (invoiceId) {
      qb.andWhere('invoice.id = :invoiceId', { invoiceId });
    }

    if (customerName) {
      qb.andWhere('invoice.customerName ILIKE :name', {
        name: `%${customerName}%`,
      });
    }

    if (startDate && endDate) {
      qb.andWhere('tx.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    if (minAmount !== undefined && maxAmount !== undefined) {
      qb.andWhere('tx.amount BETWEEN :min AND :max', {
        min: minAmount,
        max: maxAmount,
      });
    } else if (minAmount !== undefined) {
      qb.andWhere('tx.amount >= :min', { min: minAmount });
    } else if (maxAmount !== undefined) {
      qb.andWhere('tx.amount <= :max', { max: maxAmount });
    }

    qb.orderBy('tx.id', 'DESC');

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

  // ==================================================
  // 🛠 ADMIN: GET ALL TRANSACTIONS (WITH FILTERS)
  // ==================================================
  async getAllTransactions(query: any) {
    const {
      page = 1,
      limit = 10,
      status,
      paymentType,
      provider,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      userId,
      invoiceId,
      customerName,
    } = query;

    const qb = this.txRepo.createQueryBuilder('tx');

    qb.leftJoinAndSelect('tx.user', 'user');
    qb.leftJoinAndSelect('tx.invoice', 'invoice');

    // ================= FILTERS =================

    if (userId) {
      qb.andWhere('user.id = :userId', { userId });
    }

    if (status) {
      qb.andWhere('tx.status = :status', { status });
    }

    if (paymentType) {
      qb.andWhere('tx.paymentType = :paymentType', { paymentType });
    }

    if (provider) {
      qb.andWhere('tx.provider = :provider', { provider });
    }

    if (invoiceId) {
      qb.andWhere('invoice.id = :invoiceId', { invoiceId });
    }

    if (customerName) {
      qb.andWhere('invoice.customerName ILIKE :name', {
        name: `%${customerName}%`,
      });
    }

    if (startDate && endDate) {
      qb.andWhere('tx.createdAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    if (minAmount !== undefined && maxAmount !== undefined) {
      qb.andWhere('tx.amount BETWEEN :min AND :max', {
        min: minAmount,
        max: maxAmount,
      });
    } else if (minAmount !== undefined) {
      qb.andWhere('tx.amount >= :min', { min: minAmount });
    } else if (maxAmount !== undefined) {
      qb.andWhere('tx.amount <= :max', { max: maxAmount });
    }

    qb.orderBy('tx.id', 'DESC');

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

  // ==============================
  // 🔍 GET ONE TRANSACTION
  // ==============================
  async getTransaction(id: number, user: any) {
    const tx = await this.txRepo.findOne({
      where: { id },
      relations: ['user', 'invoice'],
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.user.id !== user.sub && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    return tx;
  }
}