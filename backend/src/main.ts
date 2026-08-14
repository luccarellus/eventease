import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap.config';
import { getEnv, requireEnv, requireJwtRefreshSecret } from './common/env.util';

async function bootstrap() {
  try {
    requireEnv('JWT_SECRET');
    requireJwtRefreshSecret();
    requireEnv('DATABASE_URL');
    requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
    requireEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  } catch (err) {
    console.error('❌ ERRO CRÍTICO NAS VARIÁVEIS DE AMBIENTE:', (err as Error).message);
    console.error('👉 Certifique-se de configurar todas as variáveis no painel do Easypanel (aba Ambiente).');
  }

  if (!getEnv('COOKIE_SECRET')) {
    console.warn('[bootstrap] COOKIE_SECRET não definida. Usando JWT_SECRET como fallback.');
  }

  if (!getEnv('RECAPTCHA_SECRET_KEY')) {
    console.warn('[bootstrap] RECAPTCHA_SECRET_KEY não definida.');
  }

  if (!getEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY')) {
    console.warn('[bootstrap] SUPABASE_SERVICE_ROLE_KEY não definida. Usando SUPABASE_ANON_KEY como fallback.');
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
void bootstrap();
