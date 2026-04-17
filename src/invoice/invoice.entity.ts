import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/user/user.entity';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  customerName!: string;

  @Column()
  date!: string;

  @Column('float')
  totalAmount!: number;

  @Column('jsonb')
  products!: any[];

  @Column({ nullable: true })
  qrCode!: string;

  @Column({ nullable: true })
  pdfPath!: string;

  @ManyToOne(() => User, (user) => user.id)
  user!: User;
}