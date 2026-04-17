import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import path from 'path/win32';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
  app.useGlobalPipes(new ValidationPipe());
  
  // directory path for upload files
  const uploadPath = path.join(process.cwd(), 'uploads');
  console.log('Serving uploads from:', uploadPath);
  app.use('/uploads', express.static(uploadPath));
}
bootstrap();
