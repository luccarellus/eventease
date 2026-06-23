import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/dist/app.module.js';
import { configureApp } from '../backend/dist/common/bootstrap.config.js';
import { requireEnv } from '../backend/dist/common/env.util.js';

let cachedServer: any;

function assertRequiredEnvVars() {
  requireEnv('DATABASE_URL');
  requireEnv('JWT_SECRET');
  requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  requireEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');
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
