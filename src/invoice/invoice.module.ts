import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { User } from 'src/user/user.entity';
import { SettingModule } from 'src/settings/setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, User]),
    SettingModule,
  ],
  providers: [InvoiceService],
  controllers: [InvoiceController],
})
export class InvoiceModule {}
