import { Organization } from 'src/organization/organization.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}

export enum VerificationStatus {
  VERIFIED = 'verified',
  PENDING = 'pending',
  NOT_VERIFIED = 'not_verified',
}

// ✅ NEW ENUM for organization roles
export enum OrgRole {
  OWNER = 'owner',
  STAFF = 'staff',
  USER = 'user',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  phone!: string;

  @Column()
  tax_number!: string;

  // ✅ SYSTEM ROLE (admin / user)
  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role!: Role;

  // ✅ VERIFICATION
  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.NOT_VERIFIED,
  })
  verificationStatus!: VerificationStatus;

  @Column({ nullable: true })
  refreshToken!: string;

  // ✅ TIMESTAMPS
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ===============================
  // 🏢 ORGANIZATION (TEAM FEATURE)
  // ===============================

  @ManyToOne(() => Organization, { nullable: true })
  organization!: Organization | null;

  // ✅ SEPARATE FIELD (IMPORTANT)
  @Column({
    type: 'enum',
    enum: OrgRole,
    nullable: true,
  })
  orgRole!: OrgRole;
}