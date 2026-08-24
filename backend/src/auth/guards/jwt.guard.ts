import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import type { MultiTenantRequest } from '../../common/decorators/tenant.decorator';
import { Role } from '../rbac.constants';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string | null;
  tokenType?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MultiTenantRequest>();
    const token = this.extractTokenFromHeaderOrCookie(request);
    if (!token) {
      throw new UnauthorizedException('Token não encontrado.');
    }
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      if (
        !payload.sub ||
        (payload.tokenType && payload.tokenType !== 'access')
      ) {
        throw new UnauthorizedException('Token inválido.');
      }

      const user = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          tenantId: true,
          tenant: true,
        },
      });
      if (!user) {
        throw new UnauthorizedException('Usuário não autorizado.');
      }

      request.user = {
        sub: user.id,
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      };

      // Se o usuário tem tenantId vinculado e não é super_admin, força o tenantId da requisição
      if (user.tenantId && user.role !== Role.SUPER_ADMIN) {
        request.tenantId = user.tenantId;
        if (user.tenant) {
          request.tenant = user.tenant;
        }
      }
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }
    return true;
  }

  private extractTokenFromHeaderOrCookie(request: MultiTenantRequest): string | undefined {
    let token: string | undefined = request.cookies?.access_token as
      | string
      | undefined;
    if (!token) {
      const [type, authHeaderToken] =
        request.headers.authorization?.split(' ') ?? [];
      token = type === 'Bearer' ? authHeaderToken : undefined;
    }
    return token;
  }
}
