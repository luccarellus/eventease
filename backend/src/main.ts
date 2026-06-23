import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap.config';

async function bootstrap() {
  const requiredEnvVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`FATAL: A variável de ambiente ${envVar} não está definida. Verifique o arquivo .env`);
    }
  }

  const app = await NestFactory.create(AppModule);

  // Unified configuration (CORS, Helmet, cookies, pipes)
  configureApp(app);

  // Iniciar Servidor
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`✅ EventEase API rodando em: http://localhost:${port}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
}
bootstrap();
