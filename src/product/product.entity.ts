import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';

import { User } from 'src/user/user.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  // ✅ INDEXED FOR SEARCH
  @Index()
  @Column()
  name!: string;

  @Column('float')
  price!: number;

  @Column()
  category!: string;

  @Column({ nullable: true })
  imageUrl!: string;

  // ✅ GLOBAL OR LOCAL
  @Column({ default: false })
  isGlobal!: boolean;

  // ✅ OWNER
  @ManyToOne(() => User, { nullable: true })
  user!: User;

  // ✅ TIMESTAMPS
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}