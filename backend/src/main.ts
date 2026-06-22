import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validações de variáveis de ambiente obrigatórias
  const requiredEnvVars = ['JWT_SECRET', 'COOKIE_SECRET', 'FRONTEND_URL', 'DATABASE_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`FATAL: A variável de ambiente ${envVar} não está definida. Verifique o arquivo .env`);
    }
  }

  // Unified configuration (CORS, Helmet, cookies, pipes)
  configureApp(app);

  // Iniciar Servidor
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`✅ EventEase API rodando em: http://localhost:${port}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
}
bootstrap();

