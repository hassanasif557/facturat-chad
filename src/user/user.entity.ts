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

  // ✅ UNIQUE PHONE
  @Column({ unique: true })
  phone!: string;

  @Column({ unique: true })
  tax_number!: string;

  // ✅ PROFILE IMAGE
  @Column({ nullable: true })
  profilePicture!: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role!: Role;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.NOT_VERIFIED,
  })
  verificationStatus!: VerificationStatus;

  @Column({ nullable: true })
  refreshToken!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Organization, { nullable: true })
  organization!: Organization | null;

  @Column({
    type: 'enum',
    enum: OrgRole,
    nullable: true,
  })
  orgRole!: OrgRole;

  @Column({ nullable: true })
  fcmToken!: string;

  @Column({ nullable: true })
  otp!: string;

  @Column({ nullable: true })
  otpExpiry!: Date;

  @Column({ default: false })
  otpVerified!: boolean;
}
