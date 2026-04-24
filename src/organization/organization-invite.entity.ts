import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { User } from 'src/user/user.entity';
import { Organization } from './organization.entity';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity()
export class OrganizationInvite {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Organization)
  organization!: Organization;

  @ManyToOne(() => User)
  invitedUser!: User;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status!: InviteStatus;

  @CreateDateColumn()
  createdAt!: Date;
}