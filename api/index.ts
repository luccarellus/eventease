import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/src/app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

let cachedServer: any;

async function bootstrapServer(): Promise<any> {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule);

    // Dynamic CORS configuration
    const allowedOrigins = [
      ...(process.env.FRONTEND_URL || '').split(','),
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    ].filter(Boolean);

    app.enableCors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    app.use(helmet({
      contentSecurityPolicy: false,
    }));

    const cookieSecret = process.env.COOKIE_SECRET || 'fallback-cookie-secret';
    app.use((cookieParser as any)(cookieSecret));

    // Global Validation Pipe
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));

    // Middleware to remove the /api prefix before routing to NestJS controllers
    app.use((req: any, res: any, next: any) => {
      if (req.url.startsWith('/api')) {
        req.url = req.url.substring(4) || '/';
      }
      next();
    });

    await app.init();

    cachedServer = app.getHttpAdapter().getInstance();
  }
  return cachedServer;
}

export default async function handler(req: any, res: any) {
  const server = await bootstrapServer();
  return server(req, res);
}
