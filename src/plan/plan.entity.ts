import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Plan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string; // Free, Solo, Pro, Business

  @Column({ nullable: true })
  invoiceLimit!: number; // null = unlimited

  @Column({ nullable: true })
  userLimit!: number; // null = unlimited

  @Column('float', { default: 0 })
  price!: number;

  @Column()
  durationDays!: number; // ✅ NEW (IMPORTANT)

  @Column({ default: false })
  isTeamPlan!: boolean; // Pro & Business = true
}