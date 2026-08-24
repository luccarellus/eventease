import { applyDecorators, UseGuards } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { RequirePermissions } from './permissions.decorator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permission, Role } from '../rbac.constants';

export function AdminRoute(...roles: (Role | string)[]) {
  const effectiveRoles = roles.length > 0 ? roles : [Role.SUPER_ADMIN, Role.ADMIN];
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...effectiveRoles),
  );
}

export function ProtectedRouteWithPermissions(...permissions: Permission[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    RequirePermissions(...permissions),
  );
}
