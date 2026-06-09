import { Controller, Post, Res, Body, UnauthorizedException, UseGuards, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './guards/supabase.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetRoleDto } from './dto/set-role.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('set-role')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  async setRole(@Body() setRoleDto: SetRoleDto) {
    const updatedUser = await this.authService.updateUserRole(setRoleDto.userId, setRoleDto.role);
    return {
      message: 'Role do usuário atualizada com sucesso no Supabase!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        appMetadata: updatedUser.app_metadata,
      },
    };
  }


  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.registerUser(
      registerDto.email,
      registerDto.password,
      registerDto.fullName
    );
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const { accessToken, refreshToken } = await this.authService.generateTokens(user);

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Configurado como 'strict' para mitigar CSRF
      maxAge: 15 * 60 * 1000, // 15m
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Configurado como 'strict' para mitigar CSRF
      path: '/auth/refresh', // Apenas enviado para a rota de refresh
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    return { message: 'Login bem-sucedido', user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');
    return { message: 'Logout bem-sucedido' };
  }
}
