import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
// @ts-ignore Gerado pelo build do backend (backend/dist) antes do bundle da Vercel.
import { AppModule } from '../backend/dist/app.module.js';
// @ts-ignore Gerado pelo build do backend (backend/dist) antes do bundle da Vercel.
import { configureApp } from '../backend/dist/common/bootstrap.config.js';
// @ts-ignore Gerado pelo build do backend (backend/dist) antes do bundle da Vercel.
import { getEnv, requireEnv, requireJwtRefreshSecret, maskConnectionString } from '../backend/dist/common/env.util.js';

type ExpressLikeHandler = (req: Request, res: Response) => unknown;

let cachedServer: ExpressLikeHandler | null = null;
let bootstrapError: string | null = null;

function sanitizeError(errStr: string | null): string | null {
  if (!errStr) return null;
  return maskConnectionString(errStr);
}

function assertRequiredEnvVars() {
  requireEnv('JWT_SECRET');
  requireJwtRefreshSecret();
  requireEnv('DATABASE_URL');

  if (!getEnv('COOKIE_SECRET')) {
    console.warn(
      '[bootstrap] ATENÇÃO: COOKIE_SECRET não configurada. Usando JWT_SECRET como fallback.',
    );
  }

  if (!getEnv('RECAPTCHA_SECRET_KEY')) {
    console.warn('[bootstrap] ATENÇÃO: RECAPTCHA_SECRET_KEY não configurada.');
  }

  const dbUrl = process.env.DATABASE_URL || '';
  console.log('[bootstrap] DATABASE_URL:', maskConnectionString(dbUrl));

  console.log('[bootstrap] JWT_SECRET definida:', !!process.env.JWT_SECRET);
  console.log('[bootstrap] NODE_ENV:', process.env.NODE_ENV || 'não definido');
}

// Health check que funciona SEM o NestJS (para teste e debug do bootstrap)
function handleHealthCheck(_req: Request, res: Response) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  return res.end(
    JSON.stringify({
      status: bootstrapError ? 'error' : 'ok',
      app: 'eventease-api',
      nestjs: !!cachedServer,
      ...(bootstrapError ? { detail: sanitizeError(bootstrapError) } : {}),
    }),
  );
}

async function bootstrapServer(): Promise<ExpressLikeHandler | null> {
  if (!cachedServer) {
    try {
      console.log('[bootstrap] Verificando variáveis de ambiente...');
      assertRequiredEnvVars();

      console.log('[bootstrap] Criando aplicação NestJS...');
      const app = await NestFactory.create(AppModule);

      console.log('[bootstrap] Configurando aplicação (CORS, Helmet, cookies, prefixo /api)...');
      // Cast necessário: o backend/dist é compilado com o @nestjs/common do
      // backend/node_modules, que difere tipicamente do da raiz.
      (configureApp as unknown as (application: typeof app) => void)(app);

      // A API usa o prefixo global /api (setGlobalPrefix em configureApp).
      // O caminho chega na function com o prefixo (ex.: /api/events), então
      // NÃO removemos nada aqui.
      console.log('[bootstrap] Inicializando módulos (conectando ao banco)...');
      await app.init();

      cachedServer = app.getHttpAdapter().getInstance() as ExpressLikeHandler;
      bootstrapError = null;
      console.log('[bootstrap] Aplicação inicializada com sucesso!');
    } catch (error: unknown) {
      let errorMessage = 'Erro desconhecido ao inicializar a aplicação.';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('[bootstrap] ERRO FATAL:', error.message);
        process.stderr.write(`[bootstrap] ERRO FATAL: ${error.message}\n`);
        process.stderr.write(
          `[bootstrap] STACK: ${error.stack?.split('\n').slice(0, 6).join('\n') || '(sem stack)'}\n`,
        );
      } else {
        const errStr = String(error);
        errorMessage = errStr;
        console.error('[bootstrap] ERRO FATAL (não-Error):', errStr);
        process.stderr.write(`[bootstrap] ERRO FATAL: ${errStr}\n`);
      }
      bootstrapError = errorMessage;
      return null;
    }
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  // Health check sem depender do NestJS
  if (req.url === '/api/health') {
    return handleHealthCheck(req, res);
  }

  try {
    const server = await bootstrapServer();
    if (!server) {
      const cleanDetail =
        sanitizeError(bootstrapError) ||
        'Erro desconhecido ao inicializar o servidor.';
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(
        JSON.stringify({
          statusCode: 503,
          message: 'Serviço temporariamente indisponível.',
          error: 'Service Unavailable',
          detail: cleanDetail,
          hint: 'Confira as variáveis de ambiente no dashboard da Vercel.',
        }),
      );
    }
    return server(req, res);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('[handler] Erro inesperado:', errorMessage);
    process.stderr.write(`[handler] Erro inesperado: ${errorMessage}\n`);

    const cleanError = sanitizeError(errorMessage);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(
      JSON.stringify({
        statusCode: 500,
        message: 'Erro interno do servidor.',
        error: 'Internal Server Error',
        detail: cleanError,
      }),
    );
  }
}
