import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/user/user.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column('float')
  price!: number;

  @Column()
  category!: string;

  @Column({ nullable: true })
  imageUrl!: string;

  @Column({ default: false })
  isGlobal!: boolean; // ✅ true = admin catalog

  @ManyToOne(() => User, { nullable: true })
  user!: User; // null for global, userId for personal
}