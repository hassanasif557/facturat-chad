// notification-template.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { NotificationEvent } from '../notification/notification-event.enum';

@Entity()
export class NotificationTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: NotificationEvent,
    unique: true,
  })
  event!: NotificationEvent;

  @Column({ default: true })
  isEnabled!: boolean;

  @Column()
  title!: string;

  @Column()
  message!: string;

  // optional JSON for advanced use
  @Column({ nullable: true })
  description?: string;
}