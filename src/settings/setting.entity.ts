import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Setting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  key!: string; // e.g. VAT_RATE

  @Column()
  value!: string; // e.g. "0.18"

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}