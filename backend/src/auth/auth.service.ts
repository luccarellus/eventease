import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { createClient } from '@supabase/supabase-js';
import { getEnv, requireEnv } from '../common/env.util';

@Injectable()
export class AuthService {
  private readonly supabase;
  private readonly supabaseAdmin;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {
    const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

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

    const { data: authData } = await this.supabaseAdmin.auth.admin.getUserById(data.user.id);
    const authUser = authData.user ?? data.user;
    const fullName = authUser.user_metadata?.full_name ?? dbUser?.fullName ?? null;

    const syncedUser = await this.prisma.adminUser.upsert({
      where: { id: authUser.id },
      update: {
        email: authUser.email ?? normalizedEmail,
        fullName,
        role: 'admin',
      },
      create: {
        id: authUser.id,
        email: authUser.email ?? normalizedEmail,
        fullName,
        role: 'admin',
      },
    });

    return {
      id: syncedUser.id,
      email: syncedUser.email,
      role: 'admin',
      fullName: syncedUser.fullName ?? null,
    };
  }

  async registerUser(email: string, pass: string, fullName?: string) {
    const normalizedEmail = this.normalizeEmail(email);

    const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: pass,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
      app_metadata: {
        role: 'admin',
      },
    });

    if (error || !data.user) {
      throw new UnauthorizedException(error?.message || 'Falha ao registrar usuário no Supabase Auth.');
    }

    const user = await this.prisma.adminUser.upsert({
      where: { id: data.user.id },
      update: {
        email: normalizedEmail,
        fullName: fullName ?? null,
        role: 'admin',
      },
      create: {
        id: data.user.id,
        email: normalizedEmail,
        fullName: fullName ?? null,
        role: 'admin',
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
