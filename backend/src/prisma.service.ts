import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dns from 'dns';
import { maskConnectionString } from './common/env.util';
import { isNetworkError } from './common/network.util';

/**
 * Resolve o host do banco para um endereço IPv4 concreto. A VPS não tem rota
 * IPv6 e o Node pode tentar o IPv6 primeiro (ENETUNREACH) — forçando o IP
 * IPv4 na connection string o pg ignora o DNS na hora de conectar.
 */
// dns.lookupSync existe no runtime do Node, mas não está tipado no @types/node
// instalado — declaração local com o tipo mínimo necessário.
const lookupSyncIpv4 = (dns as unknown as {
  lookupSync(hostname: string, options: { family: 4 }): string;
}).lookupSync;

/**
 * Resolve o host do banco para um endereço IPv4 concreto. A VPS não tem rota
 * IPv6 e o Node pode tentar o IPv6 primeiro (ENETUNREACH) — forçando o IP
 * IPv4 na connection string o pg ignora o DNS na hora de conectar.
 */
function forceIpv4ConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const hostname = url.hostname;
    // Já é um endereço IPv4: nada a fazer
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return connectionString;
    const address = lookupSyncIpv4(hostname, { family: 4 });
    if (address) {
      url.hostname = address;
      return url.toString();
    }
  } catch {
    // Se não conseguir resolver, mantém a string original
  }
  return connectionString;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly connectionString: string;

  constructor() {
    const rawConnectionString = process.env.DATABASE_URL;

    if (!rawConnectionString) {
      throw new Error(
        'DATABASE_URL não está configurada. ' +
          'Defina a variável de ambiente DATABASE_URL no dashboard do Vercel ' +
          'com a URL de conexão do PostgreSQL (Supabase Pooler: porta 6543).',
      );
    }

    // Força o host para IPv4 (evita ENETUNREACH em VPS sem rota IPv6)
    const connectionString = forceIpv4ConnectionString(rawConnectionString);

    console.log(
      '[PrismaService] Conectando ao banco:',
      maskConnectionString(connectionString),
    );
    console.log(
      '[PrismaService] DIRECT_URL definida:',
      !!process.env.DIRECT_URL,
    );

    const pool = new pg.Pool({
      connectionString,
      max: 2, // Limite de conexões seguro por container serverless
      idleTimeoutMillis: 15000, // Fecha conexões inativas mais rapidamente (15s)
      connectionTimeoutMillis: 5000, // Timeout para evitar travar o lambda
    });

    pool.on('error', (err) => {
      console.error('[PrismaService] Pool error:', err.message);
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.connectionString = connectionString;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log(
        '[PrismaService] Conexão com banco estabelecida com sucesso.',
      );
    } catch (error: unknown) {
      // Não derruba mais a API no boot: registra o erro e segue em modo
      // degradado. O endpoint /health reporta o status do banco (503).
      console.error(
        '[PrismaService] ⚠️ Banco de dados indisponível no boot — API em modo degradado.',
      );
      if (isNetworkError(error)) {
        console.error(
          '[PrismaService] ERRO DE CONEXÃO - Banco de dados inacessível.',
        );
        console.error(
          '[PrismaService] URL configurada:',
          maskConnectionString(this.connectionString),
        );
        console.error(
          '[PrismaService] Formato esperado (Supabase Pooler):',
        );
        console.error(
          '[PrismaService]   postgresql://postgres.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
        );
      }
      console.error(
        '[PrismaService] Detalhes:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (error: unknown) {
      console.error(
        '[PrismaService] Erro ao desconectar:',
        error instanceof Error ? error.message : error,
      );
    }
  }
}
