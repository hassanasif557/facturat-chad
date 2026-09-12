import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/user/user.entity';

export enum NotificationStatus {
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  message!: string;

  @Column({ nullable: true })
  event!: string;

  @Column({ nullable: true })
  type!: string; // invoice, usage, broadcast

  @Column({ nullable: true })
  fcmToken!: string;

  @Column({ type: 'jsonb', nullable: true })
  dataJson!: Record<string, any> | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'enum', enum: NotificationStatus })
  status!: NotificationStatus;

  @ManyToOne(() => User, { nullable: true })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}