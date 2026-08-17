import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { requireJwtRefreshSecret } from '../common/env.util';
import { isNetworkError } from '../common/network.util';
import { NevaProService } from '../common/nevapro.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private nevaProService: NevaProService,
  ) {}

  async onModuleInit() {
    try {
      await this.cleanupExpiredRefreshTokens();
    } catch (error) {
      // Não derruba a API no boot se o banco estiver momentaneamente
      // indisponível — a limpeza é reexecutada a cada novo refresh token.
      console.error(
        '[AuthService] Falha ao limpar refresh tokens no boot:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  private normalizeEmail(email: string) {
    return email.toLowerCase().trim();
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async updateUserRole(userId: string, role: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${userId} não encontrado.`);
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { role },
    });

    await this.revokeAllUserRefreshTokens(userId);

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
    };
  }

  generateTokens(user: { id: string; email: string; role: string }) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'access',
    };
    const refreshPayload = { sub: user.id, tokenType: 'refresh' };

    const accessToken = this.jwtService.sign(accessPayload);
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: requireJwtRefreshSecret(),
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async storeRefreshToken(userId: string, refreshToken: string) {
    await this.cleanupExpiredRefreshTokens(userId);

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async validateAndRotateRefreshToken(oldRefreshToken: string): Promise<{
    id: string;
    email: string;
    role: string;
    newAccessToken: string;
    newRefreshToken: string;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        tokenType: string;
      }>(oldRefreshToken, {
        secret: requireJwtRefreshSecret(),
      });
      if (!payload.sub || payload.tokenType !== 'refresh') {
        throw new Error('Invalid refresh token payload');
      }
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const tokenHash = this.hashToken(oldRefreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException(
        'Refresh token revogado. Faça login novamente.',
      );
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token expirado. Faça login novamente.',
      );
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: storedToken.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });

    // Revoga o token antigo e armazena o novo em uma única transação,
    // evitando emissão concorrente de tokens a partir do mesmo refresh token.
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(newRefreshToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      newAccessToken,
      newRefreshToken,
    };
  }

  async revokeAllUserRefreshTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeRefreshToken(token: string) {
    const tokenHash = this.hashToken(token);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<{
    id: string;
    email: string;
    role: string;
    fullName: string | null;
  } | null> {
    const normalizedEmail = this.normalizeEmail(email);

    try {
      const user = await this.prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user || !user.passwordHash) {
        return null;
      }

      const passwordMatch = await bcrypt.compare(pass, user.passwordHash);
      if (!passwordMatch) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName ?? null,
      };
    } catch (error) {
      if (isNetworkError(error)) {
        throw new ServiceUnavailableException(
          'Serviço de autenticação indisponível no momento.',
        );
      }

      throw error;
    }
  }

  async registerUser(email: string, pass: string, fullName?: string) {
    const normalizedEmail = this.normalizeEmail(email);

    try {
      const existing = await this.prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        throw new UnauthorizedException('E-mail já cadastrado.');
      }

      const passwordHash = await bcrypt.hash(pass, 10);

      const user = await this.prisma.adminUser.create({
        data: {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          fullName: fullName ?? null,
          role: 'user',
          passwordHash,
        },
      });

      // 🚀 Dispara a sincronização automática com o NevaPro (fire-and-forget)
      void this.nevaProService.sync({
        email: user.email,
        fullName: fullName ?? undefined,
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      if (isNetworkError(error)) {
        throw new ServiceUnavailableException(
          'Serviço de autenticação indisponível no momento.',
        );
      }

      throw error;
    }
  }

  async cleanupExpiredRefreshTokens(userId?: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (userId) {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          revokedAt: { not: null },
        },
      });
    }

    await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: oneDayAgo } },
        ],
      },
    });
  }
}
