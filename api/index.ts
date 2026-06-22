import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../backend/src/app.module';
import { configureApp } from '../backend/src/common/bootstrap.config';

let cachedServer: any;

async function bootstrapServer(): Promise<any> {
  if (!cachedServer) {
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
