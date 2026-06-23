import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap.config';
import { requireEnv } from './common/env.util';

async function bootstrap() {
  requireEnv('JWT_SECRET');
  requireEnv('DATABASE_URL');
  requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  requireEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');

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
