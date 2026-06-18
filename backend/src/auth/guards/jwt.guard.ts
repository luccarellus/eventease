import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeaderOrCookie(request);
    if (!token) {
      throw new UnauthorizedException('Token não encontrado.');
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }
    return true;
  }

  private extractTokenFromHeaderOrCookie(request: any): string | undefined {
    let token = request.cookies?.access_token;
    if (!token) {
      const [type, authHeaderToken] = request.headers.authorization?.split(' ') ?? [];
      token = type === 'Bearer' ? authHeaderToken : undefined;
    }
    return token;
  }
}
