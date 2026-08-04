import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  tokenType?: string;
}

type AuthenticatedRequest = Request & { user?: AccessTokenPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
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
        throw new UnauthorizedException('Token invalido.');
      }

      const user = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });
      if (!user) {
        throw new UnauthorizedException('Usuario nao autorizado.');
      }

      request.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenType: 'access',
      };
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }
    return true;
  }
  private extractTokenFromHeaderOrCookie(request: Request): string | undefined {
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
