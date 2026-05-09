import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Plan {
  @PrimaryGeneratedColumn()
  id!: number;

  // ✅ UNIQUE PLAN NAME
  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  invoiceLimit!: number;

  @Column({ nullable: true })
  userLimit!: number;

  @Column('float', { default: 0 })
  price!: number;

  @Column()
  durationDays!: number;

  @Column({ default: false })
  isTeamPlan!: boolean;
}