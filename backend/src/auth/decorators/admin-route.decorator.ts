import { applyDecorators, UseGuards } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../guards/roles.guard';

export function AdminRoute() {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles('admin'));
}
