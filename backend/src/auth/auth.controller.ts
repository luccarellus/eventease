import { Controller, Get, Post, Res, Body, UnauthorizedException, UseGuards, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetRoleDto } from './dto/set-role.dto';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getRefreshTokenClearCookieOptions,
} from '../common/cookie-options.util';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('set-role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setRole(@Body() setRoleDto: SetRoleDto) {
    const updatedUser = await this.authService.updateUserRole(setRoleDto.userId, setRoleDto.role);
    return {
      message: 'Role do usuário atualizada com sucesso!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
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
    await this.authService.storeRefreshToken(user.id, refreshToken);

    response.cookie('access_token', accessToken, getAccessTokenCookieOptions());
    response.cookie('refresh_token', refreshToken, getRefreshTokenCookieOptions());

    return { message: 'Login bem-sucedido', user };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = (req as any).cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token não encontrado.');
    }

    const { newAccessToken, newRefreshToken } = await this.authService.validateAndRotateRefreshToken(refreshToken);

    response.cookie('access_token', newAccessToken, getAccessTokenCookieOptions());
    response.cookie('refresh_token', newRefreshToken, getRefreshTokenCookieOptions());

    return { message: 'Token renovado com sucesso.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: any) {
    return { user: req.user };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = (req as any).cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }
    response.clearCookie('access_token');
    response.clearCookie('refresh_token', getRefreshTokenClearCookieOptions());
    return { message: 'Logout bem-sucedido' };
  }
}
