import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity()
@Unique(['provider', 'providerEventId'])
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  provider!: string;

  @Column()
  providerEventId!: string;

  @Column({ nullable: true })
  providerTransactionId!: string;

  @Column({ nullable: true })
  merchantReference!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ default: false })
  signatureValid!: boolean;

  @Column({ default: false })
  processed!: boolean;

  @Column({ nullable: true })
  processedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
