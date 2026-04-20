import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from 'src/user/user.entity';

export enum InvoiceStatus {
  PAID = 'paid',
  UNPAID = 'unpaid',
  PENDING = 'pending',
}

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  customerName!: string;

  @Column()
  date!: string;

  @Column('float')
  totalAmount!: number;

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

  @ManyToOne(() => User, (user) => user.id)
  user!: User;

  // ✅ NEW (IMPORTANT)
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}