import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface RedisCandidate {
  host: string;
  port: number;
  password?: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  private readonly configuredHost: string;
  private readonly configuredPort: number;
  private readonly configuredPassword?: string;

  constructor(private configService: ConfigService) {
    // Imagem única (Easypanel): o Redis roda dentro do próprio container em
    // 127.0.0.1:6379 e SEM senha. Docker Compose: REDIS_HOST='redis' (nome do
    // serviço) com senha opcional.
    const host = this.configService.get<string>('REDIS_HOST', '')?.trim();
    this.configuredHost = host || '127.0.0.1';
    this.configuredPort =
      Number(this.configService.get<number>('REDIS_PORT', 6379)) || 6379;
    const password = this.configService.get<string>('REDIS_PASSWORD', '')?.trim();
    this.configuredPassword = password || undefined;
  }

  async onModuleInit() {
    for (const candidate of this.buildCandidates()) {
      const client = this.createClient(candidate);
      if (await this.tryConnect(client)) {
        this.client = client;
        this.isConnected = true;
        this.logger.log(
          `Conectado ao Redis com sucesso (${candidate.host}:${candidate.port})${
            candidate.password ? ' (com senha)' : ''
          }`,
        );
        return;
      }
      this.logger.warn(
        `Falha ao conectar ao Redis em ${candidate.host}:${candidate.port}. Tentando próxima opção...`,
      );
    }
    this.logger.warn(
      'Redis indisponível em todas as tentativas. Operando em modo fallback (sem cache).',
    );
  }

  /** Lista de destinos possíveis, do mais específico ao fallback. */
  private buildCandidates(): RedisCandidate[] {
    const candidates: RedisCandidate[] = [];
    const add = (c: RedisCandidate) => {
      const exists = candidates.some(
        (x) =>
          x.host === c.host &&
          x.port === c.port &&
          (x.password ?? '') === (c.password ?? ''),
      );
      if (!exists) candidates.push(c);
    };

    // 1. Configuração explícita do ambiente (compose: 'redis', imagem única: 127.0.0.1)
    add({
      host: this.configuredHost,
      port: this.configuredPort,
      password: this.configuredPassword,
    });

    // 2. Fallback para o Redis embutido da imagem única (127.0.0.1:6379)
    if (this.configuredHost !== '127.0.0.1') {
      add({ host: '127.0.0.1', port: 6379, password: this.configuredPassword });
    }

    // 3. O Redis embutido sobe SEM senha: se houver senha configurada (herdada
    //    do compose, por exemplo), tenta também sem ela.
    if (this.configuredPassword) {
      add({ host: '127.0.0.1', port: 6379 });
    }

    return candidates;
  }

  private createClient(candidate: RedisCandidate): Redis {
    const client = new Redis({
      host: candidate.host,
      port: candidate.port,
      password: candidate.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        // Reconexão contínua com backoff (máx. 5s entre tentativas).
        // Antes o cliente desistia após 2 tentativas e nunca mais reconectava,
        // deixando o health como 'redis: error' mesmo com o Redis de volta.
        return Math.min(times * 500, 5000);
      },
    });

    client.on('connect', () => {
      this.isConnected = true;
    });

    client.on('ready', () => {
      this.isConnected = true;
    });

    client.on('close', () => {
      this.isConnected = false;
    });

    client.on('error', (err: Error) => {
      this.isConnected = false;
      this.logger.warn(
        `Redis indisponível (${candidate.host}:${candidate.port}): ${err.message}`,
      );
    });

    return client;
  }

  /** Tenta conectar e validar com PING. Retorna true apenas se estiver utilizável. */
  private async tryConnect(client: Redis, timeoutMs = 3000): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    let ok = false;
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          // Resolve em qualquer caso (sucesso ou falha); o PING decide depois.
          client.connect().then(resolve, resolve);
        }),
        new Promise<void>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        }),
      ]);
      await client.ping();
      ok = true;
      return true;
    } catch {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
      if (!ok) client.disconnect();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  /** Retorna true se a conexão com o Redis estiver ativa e respondendo PONG */
  async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      return null;
    }
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
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
