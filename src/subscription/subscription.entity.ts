import { Organization } from 'src/organization/organization.entity';
import { Plan } from 'src/plan/plan.entity';
import { User } from 'src/user/user.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum SubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected',
}

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: true })
  user!: User | null;

  @ManyToOne(() => Organization, { nullable: true })
  organization!: Organization | null;

  @ManyToOne(() => Plan)
  plan!: Plan;

  @Column()
  startDate!: Date;

  @Column()
  endDate!: Date;

  @Column({ default: true })
  isActive!: boolean;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING,
  })
  status!: SubscriptionStatus;
}
