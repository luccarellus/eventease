import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/dist/app.module.js';
import { configureApp } from '../backend/dist/common/bootstrap.config.js';

let cachedServer: any;

function assertRequiredEnvVars() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'COOKIE_SECRET',
    'FRONTEND_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = requiredEnvVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`FATAL: variáveis de ambiente ausentes: ${missing.join(', ')}`);
  }
}

async function bootstrapServer(): Promise<any> {
  if (!cachedServer) {
    assertRequiredEnvVars();
    const app = await NestFactory.create(AppModule);

    // Unified configuration (CORS, Helmet, cookies, pipes)
    configureApp(app);

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
