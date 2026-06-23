import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { getEnv } from './env.util';

export function configureApp(app: INestApplication) {
  // Security HTTP Headers
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  
  // Cookie Parser for secure JWT handling
  const cookieSecret = process.env.COOKIE_SECRET || 'fallback-cookie-secret';
  app.use((cookieParser as any)(cookieSecret));

  // CORS Configuration
  const allowedOrigins = [
    ...(getEnv('FRONTEND_URL', 'VITE_FRONTEND_URL') || '').split(','),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ].map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
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
