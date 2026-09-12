import { Invoice } from 'src/invoice/invoice.entity';
import { User } from 'src/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum InvoiceIssueType {
  UNKNOWN_INVOICE = 'unknown_invoice',
  INCORRECT_AMOUNT = 'incorrect_amount',
  INCORRECT_ITEM = 'incorrect_item',
  INCORRECT_CUSTOMER = 'incorrect_customer',
  OTHER = 'other',
}

@Entity()
@Unique(['invoice', 'customerUser', 'clientRequestId'])
export class InvoiceIssue {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  invoice!: Invoice;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  customerUser!: User;

  @Column({
    type: 'enum',
    enum: InvoiceIssueType,
  })
  type!: InvoiceIssueType;

  @Column({ type: 'text' })
  message!: string;

  @Column({ default: 'open' })
  status!: string;

  @Column({ nullable: true })
  clientRequestId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
