import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { requireJwtRefreshSecret } from '../common/env.util';
import { isNetworkError } from '../common/network.util';
import { NevaProService } from '../common/nevapro.service';
import { Role, getRolePermissions } from './rbac.constants';
import { CreateUserDto } from './dto/create-user.dto';
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

  private async getDefaultTenantId(): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug: 'default' }, { slug: 'olhar-jovem' }] },
    });
    if (tenant) return tenant.id;

    const anyTenant = await this.prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (anyTenant) return anyTenant.id;

    const created = await this.prisma.tenant.create({
      data: {
        name: 'Instituto Olhar Jovem',
        slug: 'olhar-jovem',
        isActive: true,
      },
    });
    return created.id;
  }

  async updateUserRole(
    userId: string,
    role: string,
    requesterRole?: string,
    requesterTenantId?: string | null,
  ) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${userId} não encontrado.`);
    }

    if (
      requesterRole !== Role.SUPER_ADMIN &&
      requesterTenantId &&
      user.tenantId !== requesterTenantId
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar usuários de outra organização.',
      );
    }

    // Apenas super_admin pode promover alguém a super_admin
    if (role === Role.SUPER_ADMIN && requesterRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Apenas um Super Administrador pode atribuir a função de Super Administrador.',
      );
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { role },
      include: { tenant: true },
    });

    await this.revokeAllUserRefreshTokens(userId);

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      tenantId: updated.tenantId,
      tenant: updated.tenant,
    };
  }

  generateTokens(user: {
    id: string;
    email: string;
    role: string;
    tenantId?: string | null;
  }) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
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
    fullName?: string | null;
    tenantId?: string | null;
    permissions: string[];
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
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });

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
      fullName: user.fullName,
      tenantId: user.tenantId,
      permissions: getRolePermissions(user.role),
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
    tenantId: string | null;
    tenant?: unknown;
    permissions: string[];
  } | null> {
    const normalizedEmail = this.normalizeEmail(email);

    try {
      const user = await this.prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
        include: { tenant: true },
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
        tenantId: user.tenantId,
        tenant: user.tenant,
        permissions: getRolePermissions(user.role),
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

  async registerUser(
    email: string,
    pass: string,
    fullName?: string,
    tenantId?: string,
  ) {
    const normalizedEmail = this.normalizeEmail(email);

    try {
      const existing = await this.prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
      });

      const passwordHash = await bcrypt.hash(pass, 10);

      const targetTenantId = tenantId || (await this.getDefaultTenantId());

      if (existing && !existing.passwordHash) {
        const updated = await this.prisma.adminUser.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            fullName: fullName ?? existing.fullName,
            tenantId: existing.tenantId || targetTenantId,
          },
          include: { tenant: true },
        });

        return {
          id: updated.id,
          email: updated.email,
          role: updated.role,
          tenantId: updated.tenantId,
          tenant: updated.tenant,
          claimed: true,
        };
      }

      if (existing) {
        throw new UnauthorizedException('E-mail já cadastrado.');
      }

      const totalUsers = await this.prisma.adminUser.count();
      const role = totalUsers === 0 ? Role.SUPER_ADMIN : Role.USER;

      const user = await this.prisma.adminUser.create({
        data: {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          fullName: fullName ?? null,
          role,
          tenantId: targetTenantId,
          passwordHash,
        },
        include: { tenant: true },
      });

      void this.nevaProService.sync({
        email: user.email,
        fullName: fullName ?? undefined,
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
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

  async createUserForTenant(
    dto: CreateUserDto,
    requesterRole: string,
    requesterTenantId?: string | null,
  ) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const existing = await this.prisma.adminUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('E-mail já cadastrado no sistema.');
    }

    let targetTenantId = dto.tenantId;
    if (requesterRole !== Role.SUPER_ADMIN) {
      targetTenantId = requesterTenantId || (await this.getDefaultTenantId());
    } else if (!targetTenantId) {
      targetTenantId = await this.getDefaultTenantId();
    }

    const assignedRole = dto.role || Role.STAFF;
    if (assignedRole === Role.SUPER_ADMIN && requesterRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Apenas Super Administradores podem criar outro Super Administrador.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.adminUser.create({
      data: {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        fullName: dto.fullName || null,
        role: assignedRole,
        tenantId: targetTenantId,
        passwordHash,
      },
      include: { tenant: true },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenant: user.tenant,
    };
  }

  async getUsersByTenant(
    tenantId: string,
    requesterRole: string,
    requesterTenantId?: string | null,
  ) {
    const where =
      requesterRole === Role.SUPER_ADMIN
        ? tenantId === 'all'
          ? {}
          : { tenantId }
        : { tenantId: requesterTenantId || tenantId };

    return this.prisma.adminUser.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tenantId: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeUser(
    userId: string,
    requesterRole: string,
    requesterTenantId?: string | null,
  ) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (
      requesterRole !== Role.SUPER_ADMIN &&
      requesterTenantId &&
      user.tenantId !== requesterTenantId
    ) {
      throw new ForbiddenException(
        'Você não pode remover usuários de outra organização.',
      );
    }

    await this.revokeAllUserRefreshTokens(userId);

    return this.prisma.adminUser.delete({
      where: { id: userId },
    });
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
