import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', '');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    if (!host) {
      this.logger.warn('REDIS_HOST não definida. Redis operando em modo fallback.');
      return;
    }

    try {
      this.client = new Redis({
        host,
        port: Number(port),
        password: password || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy(times: number) {
          if (times > 3) {
            return null; // Para de reconectar após 3 tentativas para não travar a API
          }
          return Math.min(times * 200, 1000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Conectado ao Redis com sucesso (${host}:${port})`);
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      this.client.on('error', (err: Error) => {
        this.isConnected = false;
        this.logger.warn(`Redis indisponível (${host}:${port}): ${err.message}`);
      });
    } catch (err) {
      this.logger.warn(`Erro ao instanciar Redis: ${(err as Error).message}`);
    }
  }

  async onModuleInit() {
    if (this.client) {
      try {
        await this.client.connect();
      } catch (err) {
        this.logger.warn(`Falha na conexão inicial do Redis: ${(err as Error).message}`);
      }
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      if (ttlSeconds) {
        return await this.client.set(key, value, 'EX', ttlSeconds);
      }
      return await this.client.set(key, value);
    } catch (error) {
      return null;
    }
  }

  async del(key: string): Promise<number> {
    if (!this.client || !this.isConnected) return 0;
    try {
      return await this.client.del(key);
    } catch (error) {
      return 0;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }
}
