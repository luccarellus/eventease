import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { createClient } from '@supabase/supabase-js';
import { getEnv, requireEnv } from '../common/env.util';
import * as crypto from 'crypto';

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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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

    await this.revokeAllUserRefreshTokens(userId);

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

  async storeRefreshToken(userId: string, refreshToken: string) {
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

  async validateAndRotateRefreshToken(oldRefreshToken: string): Promise<{ id: string; email: string; role: string; newAccessToken: string; newRefreshToken: string }> {
    const tokenHash = this.hashToken(oldRefreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token revogado. Faça login novamente.');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expirado. Faça login novamente.');
    }

    const user = await this.prisma.adminUser.findUnique({ where: { id: storedToken.userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.storeRefreshToken(user.id, newRefreshToken);

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
      throw new UnauthorizedException('Usuário não autorizado. Contate um administrador.');
    }

    const { data: authData } = await this.supabaseAdmin.auth.admin.getUserById(data.user.id);
    const authUser = authData?.user ?? data.user;
    const fullName = authUser.user_metadata?.full_name ?? dbUser.fullName ?? null;

    const syncedUser = await this.prisma.adminUser.update({
      where: { id: authUser.id },
      data: {
        email: authUser.email ?? normalizedEmail,
        fullName,
      },
    });

    return {
      id: syncedUser.id,
      email: syncedUser.email,
      role: syncedUser.role,
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
        role: 'user',
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
        role: 'user',
      },
      create: {
        id: data.user.id,
        email: normalizedEmail,
        fullName: fullName ?? null,
        role: 'user',
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async cleanupExpiredRefreshTokens() {
    await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}