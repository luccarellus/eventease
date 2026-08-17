import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { getEnv, requireEnv } from './env.util';
import { AllExceptionsFilter } from './all-exceptions.filter';

export function configureApp(app: INestApplication) {
  const isProduction = process.env.NODE_ENV === 'production';

  // A API é servida sob o prefixo /api (ex.: /api/events, /api/health).
  // O frontend chama /api/... e o Nginx de produção encaminha o caminho
  // completo — sem remoção de prefixo — para esta API.
  app.setGlobalPrefix('api');

  // Confia no primeiro proxy (Nginx) para IP correto em rate-limit e reCAPTCHA
  (app as NestExpressApplication).set('trust proxy', 1);

  // Cookie Parser for secure JWT handling - fallback to JWT_SECRET or dev secret if not set
  const cookieSecret =
    getEnv('COOKIE_SECRET', 'JWT_SECRET') ||
    'dev-cookie-secret-change-in-production';
  app.use(cookieParser(cookieSecret));

  // Security HTTP Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // CORS Configuration
  const allowedOrigins = (getEnv('FRONTEND_URL', 'VITE_FRONTEND_URL') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin:
      allowedOrigins.length > 0 ? allowedOrigins : isProduction ? false : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Recaptcha-Token',
  });

  // Logging simples de requisições (observabilidade)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      Logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
        'HTTP',
      );
    });
    next();
  });

  // Global exception filter — mapeia erros Prisma e nunca vaza detalhes internos
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
}
