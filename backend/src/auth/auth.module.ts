import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma.service';
import { SupabaseAuthGuard } from './guards/supabase.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' }, // Access Token Curto
    }),
  ],
  providers: [AuthService, JwtStrategy, PrismaService, SupabaseAuthGuard, RolesGuard],
  controllers: [AuthController],
  exports: [AuthService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}

