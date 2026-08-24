import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma.service';
import type { MultiTenantRequest } from '../decorators/tenant.decorator';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private defaultTenantId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateDefaultTenant(): Promise<string> {
    if (this.defaultTenantId) {
      return this.defaultTenantId;
    }

    try {
      let defaultTenant = await this.prisma.tenant.findFirst({
        where: { OR: [{ slug: 'default' }, { slug: 'olhar-jovem' }] },
      });

      if (!defaultTenant) {
        defaultTenant = await this.prisma.tenant.findFirst({
          orderBy: { createdAt: 'asc' },
        });
      }

      if (!defaultTenant) {
        defaultTenant = await this.prisma.tenant.create({
          data: {
            name: 'Instituto Olhar Jovem',
            slug: 'olhar-jovem',
            isActive: true,
          },
        });
      }

      this.defaultTenantId = defaultTenant.id;
      return defaultTenant.id;
    } catch {
      // Fallback em caso de indisponibilidade transitória
      return '00000000-0000-0000-0000-000000000000';
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

    // Se temos um UUID ou slug especificado, valida/carrega o tenant
    if (resolvedTenantId) {
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
