import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validações de variáveis de ambiente obrigatórias
  const requiredEnvVars = ['JWT_SECRET', 'COOKIE_SECRET', 'FRONTEND_URL', 'DATABASE_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`FATAL: A variável de ambiente ${envVar} não está definida. Verifique o arquivo .env`);
    }
  }

  // Security HTTP Headers
  app.use(helmet());
  
  // Cookie Parser for secure JWT handling
  app.use((cookieParser as any)(process.env.COOKIE_SECRET));

  // CORS Configuration
  const allowedOrigins = process.env.FRONTEND_URL!.split(',').map(o => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false, // Permite campos extras sem rejeitar (necessário para formulários públicos)
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Iniciar Servidor
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`✅ EventEase API rodando em: http://localhost:${port}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`   CORS habilitado para: ${allowedOrigins.join(', ')}`);
}
bootstrap();

