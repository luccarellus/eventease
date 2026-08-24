import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface TenantPayload {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
}

export type MultiTenantRequest = Request & {
  tenantId?: string;
  tenant?: TenantPayload;
  user?: {
    sub: string;
    id?: string;
    email: string;
    role: string;
    tenantId?: string | null;
  };
};

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<MultiTenantRequest>();
    return (
      request.tenantId ||
      (request.headers['x-tenant-id'] as string) ||
      request.user?.tenantId ||
      'default'
    );
  },
);

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<MultiTenantRequest>();
    return request.tenant;
  },
);
