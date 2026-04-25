import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path'; // ✅ FIXED

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //   app.enableCors({
  //   origin: [
  //     process.env.BASE_URL_PROD,
  //     'https://www.figma.com',
  //   ],
  //   credentials: true,
  // });

  app.enableCors({
    origin: [process.env.BASE_URL_PROD, 'https://www.figma.com', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: false,
  });

  // ✅ Global validation
  app.useGlobalPipes(new ValidationPipe());

  // ✅ Static files setup (BEFORE listen)
  const uploadPath = path.join(process.cwd(), 'uploads');
  console.log('Serving uploads from:', uploadPath);

  app.use('/uploads', express.static(uploadPath));

  // ✅ Start server LAST
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
