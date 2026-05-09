import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { Invoice } from 'src/invoice/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
  Product,
  Invoice,
])],
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
