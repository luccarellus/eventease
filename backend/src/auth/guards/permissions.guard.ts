import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, Role, hasPermission } from '../rbac.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { role?: string; id?: string };
    }>();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Acesso não autorizado: usuário sem cargo definido.');
    }

    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) =>
      hasPermission(user.role!, perm),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        'Acesso negado: você não possui as permissões necessárias para realizar esta operação.',
      );
    }

    return true;
  }
}
