import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum PaymentOptionType {
  CASH = 'cash',
  MOBILE_MONEY = 'mobile_money',
  PAYMENT_LINK = 'payment_link',
}

@Entity()
export class PaymentOption {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: PaymentOptionType,
  })
  type!: PaymentOptionType;

  @Column()
  label!: string; // "Cash", "Mobile Money", etc.

  @Column({ default: true })
  isActive!: boolean;
}