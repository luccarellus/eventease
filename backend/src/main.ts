import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: A variável de ambiente JWT_SECRET não está definida.');
  }
  if (!process.env.COOKIE_SECRET) {
    throw new Error('FATAL: A variável de ambiente COOKIE_SECRET não está definida.');
  }
  if (!process.env.FRONTEND_URL) {
    throw new Error('FATAL: A variável de ambiente FRONTEND_URL não está definida.');
  }

  // Security HTTP Headers
  app.use(helmet());
  
  // Cookie Parser for secure JWT handling
  app.use((cookieParser as any)(process.env.COOKIE_SECRET));

  // CORS Configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL.split(','),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Start Server
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
