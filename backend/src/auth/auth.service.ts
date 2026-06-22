import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async updateUserRole(userId: string, role: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${userId} não encontrado.`);
    }

    // 1. Atualizar a role no banco de dados local public.admin_users
    const updated = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { role },
    });

    // 2. Atualizar a role no app_metadata do Supabase Auth para consistência do JWT
    const supabaseService = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabaseService.auth.admin.updateUserById(userId, {
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

  /**
   * Valida um refresh token e retorna os dados do usuário.
   * Lança UnauthorizedException se o token for inválido/expirado ou o usuário não existir.
   */
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
    console.log(`[Login Debug] Tentando autenticar e-mail: ${email}`);
    
    // 1. Fazer login no Supabase Auth usando o email e senha passados
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: pass,
    });

    if (error) {
      console.error(`[Login Debug] Erro no Supabase Auth: ${error.message} (status: ${error.status})`);
      return null;
    }

    if (!data.user) {
      console.error(`[Login Debug] Supabase Auth não retornou objeto de usuário.`);
      return null;
    }

    console.log(`[Login Debug] Login no Supabase Auth bem-sucedido! UUID: ${data.user.id}`);

    // 2. Verificar se o usuário existe na tabela pública de administradores (admin_users)
    const dbUser = await this.prisma.adminUser.findUnique({
      where: { id: data.user.id },
    });

    if (!dbUser) {
      console.warn(`[Login Debug] UUID ${data.user.id} existe no Supabase Auth, mas NÃO existe na tabela pública admin_users.`);
      return null;
    }

    console.log(`[Login Debug] Usuário encontrado na tabela admin_users! Role: ${dbUser.role}`);
    return {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      fullName: dbUser.fullName ?? null,
    };
  }

  async registerUser(email: string, pass: string, fullName?: string) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      throw new UnauthorizedException('Este e-mail já está cadastrado.');
    }

    // 1. Registrar no Supabase Auth
    const { data, error } = await this.supabase.auth.signUp({
      email: email.toLowerCase().trim(),
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

    // 2. Verificar se a trigger já populou o banco local
    let user = await this.prisma.adminUser.findUnique({ where: { id: data.user.id } });

    // Fallback caso a trigger de banco demore ou falhe temporariamente
    if (!user) {
      user = await this.prisma.adminUser.create({
        data: {
          id: data.user.id,
          email: email.toLowerCase().trim(),
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
