import { Organization } from "src/organization/organization.entity";
import { User } from "src/user/user.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Usage {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: true })
  user!: User;

  @ManyToOne(() => Organization, { nullable: true })
  organization!: Organization;

  @Column()
  month!: string; // "2026-04"

  @Column({ default: 0 })
  invoiceCount!: number;
}