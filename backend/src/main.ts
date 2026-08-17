import dns from 'dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap.config';
import { getEnv, requireEnv, requireJwtRefreshSecret } from './common/env.util';

// VPS sem rota IPv6: resolve hostnames (Supabase etc.) como IPv4 primeiro,
// evitando o crash ENETUNREACH no boot causado pela resolução IPv6 padrão.
dns.setDefaultResultOrder('ipv4first');

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
  // Na imagem única, a porta 80 pertence ao Nginx (frontend). O Easypanel às
  // vezes injeta PORT=80, o que conflita com o Nginx (EADDRINUSE) e derruba a
  // API no boot — a API deve escutar na 3000 (o Nginx faz o proxy /api).
  const rawPort = process.env.PORT;
  if (rawPort === '80') {
    console.warn(
      '[bootstrap] PORT=80 detectado (reservado ao Nginx). Usando porta 3000 para a API.',
    );
  }
  const port = rawPort && rawPort !== '80' ? rawPort : 3000;
  await app.listen(port);
  console.log(`✅ EventEase API rodando em: http://localhost:${port}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
}
void bootstrap();
