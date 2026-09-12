import { Invoice } from 'src/invoice/invoice.entity';
import { User } from 'src/user/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

export enum PaymentType {
  CASH = 'cash',
  MOBILE_MONEY = 'mobile_money',
  PAYMENT_LINK = 'payment_link',
}

export enum TransactionStatus {
  CREATED = 'created',
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  transactionId!: string; // external or mock TXN id

  @Column({ nullable: true, unique: true })
  publicReference!: string;

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => Invoice)
  invoice!: Invoice;

  @ManyToOne(() => User, { nullable: true })
  customerUser!: User | null;

  @Column()
  customerName!: string;

  @Column()
  amount!: number;

  @Column('int', { default: 0 })
  amountInt!: number;

  @Column({ default: 'XAF' })
  currency!: string;

  @Column({ default: 0 })
  commission!: number;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  paymentType!: PaymentType;

  @Column({
    nullable: true,
  })
  provider!: string; // airtel / moov

  @Column({
    nullable: true,
  })
  customerPhone!: string;

  @Column({ nullable: true })
  customerPhoneNormalized!: string;

  @Column({ nullable: true, unique: true })
  providerTransactionId!: string;

  @Column({ nullable: true })
  failureCode!: string;

  @Column({ nullable: true })
  failureMessage!: string;

  @Column({ nullable: true })
  idempotencyKey!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.CREATED,
  })
  status!: TransactionStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}