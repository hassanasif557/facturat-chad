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
  PaymentType,
} from './transaction.entity';

import { Invoice, InvoiceStatus } from 'src/invoice/invoice.entity';
import { User } from 'src/user/user.entity';
import { InitiatePaymentDto } from './initiate-payment.dto';

import { PaymentMethod } from 'src/payment_method/payment-method.entity';
import {
  PaymentOption,
  PaymentOptionType,
} from 'src/payment_option/payment-option.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    @InjectRepository(PaymentOption)
    private paymentOptionRepo: Repository<PaymentOption>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(PaymentMethod)
    private paymentMethodRepo: Repository<PaymentMethod>,
  ) {}

  // ======================================================
  // 🚀 INITIATE PAYMENT
  // ======================================================
  async initiatePayment(user: any, dto: InitiatePaymentDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: dto.invoice_id },
      relations: ['user', 'organization'],
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.user.id !== user.sub) {
      throw new ForbiddenException('Not your invoice');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice already paid');
    }

    // ===============================
    // 💳 GET PAYMENT OPTION
    // ===============================
    const option = await this.paymentOptionRepo.findOne({
      where: { id: dto.paymentOptionId, isActive: true },
    });

    if (!option) {
      throw new NotFoundException('Payment option not available');
    }

    // ===============================
    // 💰 COMMISSION
    // ===============================
    const commission = invoice.totalAmount * 0.02;

    // ===============================
    // ❌ PREVENT DUPLICATE PAYMENT
    // ===============================
    const existingTx = await this.txRepo.findOne({
      where: {
        invoice: { id: invoice.id },
        status: TransactionStatus.PENDING,
      },
    });

    if (existingTx) {
      throw new BadRequestException('Payment already in progress');
    }

    // ======================================================
    // 💵 CASH FLOW
    // ======================================================
    if (option.type === PaymentOptionType.CASH) {
      invoice.status = InvoiceStatus.PAID;
      await this.invoiceRepo.save(invoice);

      const tx = this.txRepo.create({
        transactionId: 'TXN-' + Date.now(),
        user: invoice.user,
        invoice,
        customerName: invoice.customerName,
        amount: invoice.totalAmount,
        commission,
        paymentType: PaymentType.CASH,
        status: TransactionStatus.SUCCESS,
      });

      await this.txRepo.save(tx);

      return { message: 'Marked as paid (cash)' };
    }

    // ======================================================
    // 📲 MOBILE MONEY FLOW
    // ======================================================
    if (option.type === PaymentOptionType.MOBILE_MONEY) {
      if (!dto.paymentMethodId || !dto.customer_phone) {
        throw new BadRequestException(
          'paymentMethodId and customer_phone are required',
        );
      }

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

      const tx = this.txRepo.create({
        transactionId: 'TXN-' + Date.now(),
        user: invoice.user,
        invoice,
        customerName: invoice.customerName,
        amount: invoice.totalAmount,
        commission,
        paymentType: PaymentType.MOBILE_MONEY,
        provider: method.provider,
        customerPhone: dto.customer_phone,
        status: TransactionStatus.PENDING,
      });

      const saved = await this.txRepo.save(tx);

      return {
        message: 'Mobile money payment initiated (mock)',
        transactionId: saved.transactionId,
        status: saved.status,
      };
    }

    // ======================================================
    // 🔗 PAYMENT LINK FLOW
    // ======================================================
    if (option.type === PaymentOptionType.PAYMENT_LINK) {
      const tx = this.txRepo.create({
        transactionId: 'TXN-' + Date.now(),
        user: invoice.user,
        invoice,
        customerName: invoice.customerName,
        amount: invoice.totalAmount,
        commission,
        paymentType: PaymentType.PAYMENT_LINK,
        status: TransactionStatus.PENDING,
      });

      const saved = await this.txRepo.save(tx);

      const link = `${process.env.BASE_URL}/pay/${saved.transactionId}`;

      return {
        message: 'Payment link generated',
        link,
        transactionId: saved.transactionId,
      };
    }

    throw new BadRequestException('Invalid payment option');
  }

  // ======================================================
  // 🔔 MOCK WEBHOOK
  // ======================================================
  async mockWebhook(transactionId: string, status: 'SUCCESS' | 'FAILED') {
    const tx = await this.txRepo.findOne({
      where: { transactionId },
      relations: ['invoice', 'user'],
    });

    if (!tx) throw new NotFoundException('Transaction not found');

    if (tx.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Already processed');
    }

    tx.status =
      status === 'SUCCESS'
        ? TransactionStatus.SUCCESS
        : TransactionStatus.FAILED;

    await this.txRepo.save(tx);

    if (status === 'SUCCESS') {
      tx.invoice.status = InvoiceStatus.PAID;
      await this.invoiceRepo.save(tx.invoice);
    }

    return {
      message: 'Webhook processed',
      transaction: tx,
    };
  }

  // ======================================================
  // 👤 USER TRANSACTIONS (FILTER + PAGINATION)
  // ======================================================
  async getMyTransactions(user: any, query: any) {
    const qb = this.txRepo.createQueryBuilder('tx');

    qb.leftJoinAndSelect('tx.invoice', 'invoice');
    qb.where('tx.userId = :userId', { userId: user.sub });

    this.applyFilters(qb, query);

    qb.orderBy('tx.id', 'DESC');

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  // ======================================================
  // 🛠 ADMIN TRANSACTIONS (FILTER + PAGINATION)
  // ======================================================
  async getAllTransactions(query: any) {
    const qb = this.txRepo.createQueryBuilder('tx');

    qb.leftJoinAndSelect('tx.user', 'user');
    qb.leftJoinAndSelect('tx.invoice', 'invoice');

    if (query.userId) {
      qb.andWhere('user.id = :userId', { userId: query.userId });
    }

    this.applyFilters(qb, query);

    qb.orderBy('tx.id', 'DESC');

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  // ======================================================
  // 🔍 SINGLE TRANSACTION
  // ======================================================
  async getTransaction(id: number, user: any) {
    const tx = await this.txRepo.findOne({
      where: { id },
      relations: ['user', 'invoice'],
    });

    if (!tx) throw new NotFoundException('Transaction not found');

    if (tx.user.id !== user.sub && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    return tx;
  }

  // ======================================================
  // 🧠 SHARED FILTER LOGIC
  // ======================================================
  private applyFilters(qb: any, query: any) {
    const {
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

    if (status) qb.andWhere('tx.status = :status', { status });

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
  }
}