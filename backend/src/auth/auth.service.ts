import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL e SUPABASE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) não estão configuradas nas variáveis de ambiente.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async updateUserRole(userId: string, role: string) {
    const { data, error } = await this.supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });

    if (error) {
      throw new Error(`Erro ao atualizar a role do usuário no Supabase: ${error.message}`);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      role: data.user.app_metadata?.role,
    };
  }

  async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: pass,
    });

    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
      role: data.user.app_metadata?.role || 'user',
      fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.fullName || null,
    };
  }

  async registerUser(email: string, pass: string, fullName?: string) {
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
      throw new Error(`Erro ao registrar usuário no Supabase: ${error.message}`);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      role: data.user.app_metadata?.role || 'user',
    };
  }
}
