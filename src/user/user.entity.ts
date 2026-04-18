import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}

export enum VerificationStatus {
  VERIFIED = 'verified',
  PENDING = 'pending',
  NOT_VERIFIED = 'not_verified',
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

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role!: Role;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus!: VerificationStatus;

  // ✅ NEW FIELD for refresh tokens
  @Column({ nullable: true })
  refreshToken!: string;
}