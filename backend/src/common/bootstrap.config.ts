import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { getEnv, requireEnv } from './env.util';

export function configureApp(app: INestApplication) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Cookie Parser for secure JWT handling - fail in production if secret not set
  const cookieSecret = isProduction 
    ? requireEnv('COOKIE_SECRET')
    : (process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production');
  const parser = typeof cookieParser === 'function' ? cookieParser : (cookieParser as any).default;
  app.use(parser(cookieSecret));

  // Security HTTP Headers
  app.use(helmet({
    contentSecurityPolicy: false,
  }));

  // CORS Configuration
  const allowedOrigins = [
    ...(getEnv('FRONTEND_URL', 'VITE_FRONTEND_URL') || '').split(','),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : (isProduction ? false : true),
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
}
