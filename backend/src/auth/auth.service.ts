import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  private readonly supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  private readonly supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  private normalizeEmail(email: string) {
    return email.toLowerCase().trim();
  }

  async updateUserRole(userId: string, role: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${userId} não encontrado.`);
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { role },
    });

    await this.supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
    };
  }

  async generateTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async validateRefreshToken(token: string): Promise<{ id: string; email: string; role: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado.');
      }
      return { id: user.id, email: user.email, role: user.role };
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado. Faça login novamente.');
    }
  }

  async validateUser(email: string, pass: string): Promise<{ id: string; email: string; role: string; fullName: string | null } | null> {
    const normalizedEmail = this.normalizeEmail(email);

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass,
    });

    if (error || !data.user) {
      return null;
    }

    const dbUser = await this.prisma.adminUser.findUnique({
      where: { id: data.user.id },
    });

    if (!dbUser) {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      fullName: dbUser.fullName ?? null,
    };
  }

  async registerUser(email: string, pass: string, fullName?: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new UnauthorizedException('Este e-mail já está cadastrado.');
    }

    const { data, error } = await this.supabase.auth.signUp({
      email: normalizedEmail,
      password: pass,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error || !data.user) {
      throw new UnauthorizedException(error?.message || 'Falha ao registrar usuário no Supabase Auth.');
    }

    let user = await this.prisma.adminUser.findUnique({ where: { id: data.user.id } });

    if (!user) {
      user = await this.prisma.adminUser.create({
        data: {
          id: data.user.id,
          email: normalizedEmail,
          fullName: fullName ?? null,
          role: 'admin',
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
