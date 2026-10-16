import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../redis.service';
import { CACHE_KEYS, CACHE_TTL, safeParse } from '../cache.keys';
import type { MultiTenantRequest } from '../decorators/tenant.decorator';
import type { Tenant } from '@prisma/client';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private defaultTenantId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async getOrCreateDefaultTenant(): Promise<string> {
    if (this.defaultTenantId) {
      return this.defaultTenantId;
    }

    // Tenta obter do Redis
    try {
      const cached = await this.redis.get(CACHE_KEYS.defaultTenantId);
      if (cached) {
        this.defaultTenantId = cached;
        return cached;
      }
    } catch {
      // Ignora erro do Redis
    }

    try {
      let defaultTenant = await this.prisma.tenant.findFirst({
        where: { OR: [{ slug: 'default' }, { slug: 'eventease' }, { slug: 'olhar-jovem' }] },
      });

      if (!defaultTenant) {
        defaultTenant = await this.prisma.tenant.findFirst({
          orderBy: { createdAt: 'asc' },
        });
      }

      if (!defaultTenant) {
        defaultTenant = await this.prisma.tenant.create({
          data: {
            name: 'EventEase',
            slug: 'eventease',
            isActive: true,
          },
        });
      }

      this.defaultTenantId = defaultTenant.id;
      await this.redis
        .set(CACHE_KEYS.defaultTenantId, defaultTenant.id, CACHE_TTL.tenantLookup)
        .catch(() => {});
      return defaultTenant.id;
    } catch {
      // Fallback em caso de indisponibilidade transitória
      return 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    }
  }

  async use(req: MultiTenantRequest, res: Response, next: NextFunction) {
    const rawHeaderTenantId = req.headers['x-tenant-id'];
    const headerTenantId = Array.isArray(rawHeaderTenantId)
      ? rawHeaderTenantId[0]
      : rawHeaderTenantId;
    const queryTenant = (req.query?.tenantId || req.query?.tenantSlug) as string | undefined;

    let resolvedTenantId: string | null = null;

    if (headerTenantId && headerTenantId.trim() !== '') {
      resolvedTenantId = headerTenantId.trim();
    } else if (queryTenant && queryTenant.trim() !== '') {
      resolvedTenantId = queryTenant.trim();
    }

    // Se temos um UUID ou slug especificado, valida/carrega o tenant com cache Redis
    if (resolvedTenantId) {
      const cacheKey = CACHE_KEYS.tenantLookup(resolvedTenantId);
      try {
        const cachedTenant = safeParse<Tenant>(await this.redis.get(cacheKey));
        if (cachedTenant) {
          req.tenantId = cachedTenant.id;
          req.tenant = cachedTenant;
          return next();
        }
      } catch {
        // Ignora erro do Redis
      }

      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          resolvedTenantId,
        );

        const tenant = await this.prisma.tenant.findFirst({
          where: isUuid
            ? { id: resolvedTenantId, isActive: true }
            : { slug: resolvedTenantId, isActive: true },
        });

        if (tenant) {
          req.tenantId = tenant.id;
          req.tenant = tenant;
          await this.redis
            .set(cacheKey, JSON.stringify(tenant), CACHE_TTL.tenantLookup)
            .catch(() => {});
          return next();
        }
      } catch {
        // Ignora erro e recorre ao default
      }
    }

    // Fallback para o tenant padrão
    const defaultId = await this.getOrCreateDefaultTenant();
    req.tenantId = defaultId;

    next();
  }
}
