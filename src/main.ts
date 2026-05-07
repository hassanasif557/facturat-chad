import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ======================================
  // ✅ CORS
  // ======================================
  app.enableCors({
    origin: [
      process.env.BASE_URL_PROD,
      'https://www.figma.com',
      'http://localhost:5173',

      // ✅ VPS FRONTEND
      'http://67.211.218.25:81',
    ],

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
    ],

    credentials: false,
  });

  // ======================================
  // ✅ GLOBAL VALIDATION
  // ======================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      // removes unknown fields
      forbidNonWhitelisted: false,

      // auto-transform types
      transform: true,
    }),
  );

  // ======================================
  // ✅ STATIC FILES
  // ======================================
  const uploadPath = path.join(process.cwd(), 'uploads');

  console.log('📁 Serving uploads from:', uploadPath);

  app.use('/uploads', express.static(uploadPath));

  // ======================================
  // ✅ PORT
  // ======================================
  const port = process.env.PORT || 3000;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Server running on:
  
  Local:   http://localhost:${port}
  VPS:     http://67.211.218.25:${port}
  
  Uploads: http://67.211.218.25:${port}/uploads/
  `);
}

bootstrap();