import { User } from 'src/user/user.entity';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentProvider {
  AIRTEL = 'airtel',
  MOOV = 'moov',
}

@Entity()
export class PaymentMethod {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  provider!: PaymentProvider;

  // 📱 Wallet / phone number
  @Column()
  accountNumber!: string;

  // 🏷️ Account Name (e.g. "Main Airtel")
  @Column({ nullable: true })
  accountName!: string;

  // ✅ Active / inactive
  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}