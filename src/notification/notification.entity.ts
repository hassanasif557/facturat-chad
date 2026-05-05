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

  @Column({ type: 'enum', enum: NotificationStatus })
  status!: NotificationStatus;

  @ManyToOne(() => User, { nullable: true })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}