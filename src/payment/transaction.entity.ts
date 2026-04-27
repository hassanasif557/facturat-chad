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
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  transactionId!: string; // external or mock TXN id

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => Invoice)
  invoice!: Invoice;

  @Column()
  customerName!: string;

  @Column()
  amount!: number;

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

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @CreateDateColumn()
  createdAt!: Date;
}