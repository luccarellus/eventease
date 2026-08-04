import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { maskConnectionString } from './common/env.util';
import { isNetworkError } from './common/network.util';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly connectionString: string;

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL não está configurada. ' +
          'Defina a variável de ambiente DATABASE_URL no dashboard do Vercel ' +
          'com a URL de conexão do PostgreSQL (Supabase Pooler: porta 6543).',
      );
    }

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
      if (isNetworkError(error)) {
        console.error(
          '[PrismaService] ERRO DE CONEXÃO - Banco de dados inacessível.',
        );
        console.error(
          '[PrismaService] URL configurada:',
          maskConnectionString(this.connectionString),
        );
        console.error(
          '[PrismaService] Verifique se o DATABASE_URL no Vercel está correto.',
        );
        console.error(
          '[PrismaService] O .env.example mostra o formato esperado:',
        );
        console.error(
          '[PrismaService]   postgresql://postgres.xxxx:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
        );
        throw new ServiceUnavailableException(
          'Banco de dados indisponível. Verifique a configuração de DATABASE_URL no ambiente de produção.',
        );
      }
      throw error;
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
