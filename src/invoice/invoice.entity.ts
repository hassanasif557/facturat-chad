import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from 'src/user/user.entity';
import { Organization } from 'src/organization/organization.entity';

export enum InvoiceStatus {
  PAID = 'paid',
  UNPAID = 'unpaid',
  PENDING = 'pending',
  ISSUED = 'issued',
  PARTIALLY_PAID = 'partially_paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum InvoicePaymentStatus {
  CREATED = 'created',
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  UNPAID = 'unpaid',
}

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  customerName!: string;

  @Column({ nullable: true })
  customerPhone!: string;

  @Column({ nullable: true })
  customerPhoneNormalized!: string;

  @Column({ nullable: true })
  customerEmail!: string;

  @Column()
  date!: string;

  @Column('int', { default: 0 })
  totalAmount!: number;

  @Column({ nullable: true })
  invoiceNumber!: string;

  @Column({ nullable: true })
  issuedAt!: Date;

  @Column({ nullable: true })
  dueAt!: Date;

  @Column({ default: 'XAF' })
  currency!: string;

  @Column('int', { default: 0 })
  subtotalAmount!: number;

  @Column('int', { default: 0 })
  taxAmount!: number;

  @Column('int', { default: 0 })
  discountAmount!: number;

  @Column('int', { default: 0 })
  amountPaid!: number;

  @Column('int', { default: 0 })
  balanceDue!: number;

  @Column({
    type: 'enum',
    enum: InvoicePaymentStatus,
    default: InvoicePaymentStatus.UNPAID,
  })
  paymentStatus!: InvoicePaymentStatus;

  @Column({ default: 'pending' })
  deliveryStatus!: string;

  @Column('jsonb')
  products!: any[];

  @Column({ nullable: true })
  qrCode!: string;

  @Column({ nullable: true })
  pdfPath!: string;

  // ✅ NEW STATUS FIELD
  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status!: InvoiceStatus;

  @ManyToOne(() => Organization, { nullable: true })
  organization!: Organization | null;

  @ManyToOne(() => User, (user) => user.id)
  user!: User;

  @ManyToOne(() => User, { nullable: true })
  customerUser!: User | null;

  // ✅ NEW (IMPORTANT)
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
