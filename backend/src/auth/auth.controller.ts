import {
  Controller,
  Get,
  Post,
  Res,
  Body,
  UnauthorizedException,
  ServiceUnavailableException,
  UseGuards,
  Req,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getRefreshTokenClearCookieOptions,
} from '../common/cookie-options.util';
import { MultiTenantRequest, TenantId } from '../common/decorators/tenant.decorator';
import { ALL_ROLES, ROLE_PERMISSIONS, Role, getRolePermissions } from './rbac.constants';
import { AdminRoute } from './decorators/admin-route.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('roles')
  getRolesInfo() {
    return {
      roles: ALL_ROLES,
      matrix: ROLE_PERMISSIONS,
    };
  }

  @Get('users')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN)
  async listUsers(
    @Req() req: MultiTenantRequest,
    @TenantId() tenantId: string,
  ) {
    const requesterRole = req.user?.role || Role.USER;
    const requesterTenantId = req.user?.tenantId;
    return this.authService.getUsersByTenant(
      tenantId,
      requesterRole,
      requesterTenantId,
    );
  }

  @Post('users')
  @HttpCode(HttpStatus.OK)
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN)
  async createUser(
    @Req() req: MultiTenantRequest,
    @Body() createUserDto: CreateUserDto,
  ) {
    const requesterRole = req.user?.role || Role.USER;
    const requesterTenantId = req.user?.tenantId;
    return this.authService.createUserForTenant(
      createUserDto,
      requesterRole,
      requesterTenantId,
    );
  }

  @Delete('users/:id')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN)
  async removeUser(
    @Req() req: MultiTenantRequest,
    @Param('id') id: string,
  ) {
    const requesterRole = req.user?.role || Role.USER;
    const requesterTenantId = req.user?.tenantId;
    return this.authService.removeUser(id, requesterRole, requesterTenantId);
  }

  @Post('set-role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async setRole(
    @Req() req: MultiTenantRequest,
    @Body() setRoleDto: SetRoleDto,
  ) {
    const requesterRole = req.user?.role || Role.USER;
    const requesterTenantId = req.user?.tenantId;

    const updatedUser = await this.authService.updateUserRole(
      setRoleDto.userId,
      setRoleDto.role,
      requesterRole,
      requesterTenantId,
    );

    return {
      message: 'Role do usuário atualizada com sucesso!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId,
      },
    };
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(
    @Body() registerDto: RegisterDto,
    @TenantId() tenantId: string,
  ) {
    return this.authService.registerUser(
      registerDto.email,
      registerDto.password,
      registerDto.fullName,
      tenantId,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const user = await this.authService.validateUser(
        loginDto.email,
        loginDto.password,
      );
      if (!user) {
        throw new UnauthorizedException('Credenciais inválidas.');
      }
      const { accessToken, refreshToken } =
        this.authService.generateTokens(user);
      await this.authService.storeRefreshToken(user.id, refreshToken);

      response.cookie(
        'access_token',
        accessToken,
        getAccessTokenCookieOptions(),
      );
      response.cookie(
        'refresh_token',
        refreshToken,
        getRefreshTokenCookieOptions(),
      );

      return {
        message: 'Login bem-sucedido',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          tenantId: user.tenantId,
          tenant: user.tenant,
          permissions: user.permissions,
        },
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      console.error(
        '[Auth] Erro no login:',
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token não encontrado.');
    }

    try {
      const result =
        await this.authService.validateAndRotateRefreshToken(refreshToken);

      response.cookie(
        'access_token',
        result.newAccessToken,
        getAccessTokenCookieOptions(),
      );
      response.cookie(
        'refresh_token',
        result.newRefreshToken,
        getRefreshTokenCookieOptions(),
      );

      return {
        message: 'Token renovado com sucesso.',
        user: {
          id: result.id,
          email: result.email,
          fullName: result.fullName,
          role: result.role,
          tenantId: result.tenantId,
          permissions: result.permissions,
        },
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      if (
        err instanceof Error &&
        (err.message.includes('ENOTFOUND') ||
          err.message.includes('getaddrinfo') ||
          err.message.includes('tenant/user'))
      ) {
        throw new ServiceUnavailableException(
          'Serviço temporariamente indisponível. Tente novamente mais tarde.',
        );
      }
      throw err;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: MultiTenantRequest) {
    const role = req.user?.role || Role.USER;
    return {
      user: {
        ...req.user,
        permissions: getRolePermissions(role),
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (refreshToken) {
        await this.authService.revokeRefreshToken(refreshToken);
      }
    } catch (err) {
      console.error(
        '[Auth] Erro ao revogar refresh token no logout:',
        err instanceof Error ? err.message : err,
      );
    }
    response.clearCookie('access_token', getAccessTokenCookieOptions());
    response.clearCookie('refresh_token', getRefreshTokenClearCookieOptions());
    return { message: 'Logout bem-sucedido' };
  }
}
