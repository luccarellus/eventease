import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RegistrationsService } from './registrations.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { Throttle } from '@nestjs/throttler';
import { RecaptchaService } from '../common/recaptcha.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Role } from '../auth/rbac.constants';

@Controller('registrations')
export class RegistrationsController {
  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  /**
   * Cria uma nova inscrição (fluxo público no tenant).
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async create(
    @TenantId() tenantId: string,
    @Body() data: CreateRegistrationDto,
    @Req() request: Request,
  ) {
    await this.recaptchaService.verify(
      data.recaptchaToken,
      'registration_create',
      request.ip,
    );
    return this.registrationsService.create(tenantId, {
      eventoId: data.eventoId,
      participanteId: data.participanteId,
      presente: false,
    });
  }

  @Get('check/:eventoId/:participanteId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  checkRegistration(
    @TenantId() tenantId: string,
    @Param('eventoId') eventoId: string,
    @Param('participanteId') participanteId: string,
  ) {
    return this.registrationsService.checkRegistration(
      tenantId,
      eventoId,
      participanteId,
    );
  }

  @Get()
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF, Role.VIEWER)
  findAll(@TenantId() tenantId: string) {
    return this.registrationsService.findAll(tenantId);
  }

  @Get('event/:eventoId')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF, Role.VIEWER)
  findByEvent(
    @TenantId() tenantId: string,
    @Param('eventoId') eventoId: string,
  ) {
    return this.registrationsService.findByEvent(tenantId, eventoId);
  }

  @Patch(':id/checkin')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF)
  checkIn(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.registrationsService.checkIn(tenantId, id);
  }

  @Patch(':id')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER)
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: UpdateRegistrationDto,
  ) {
    return this.registrationsService.update(tenantId, id, {
      presente: data.presente,
      confirmado_em: data.confirmado_em ? new Date(data.confirmado_em) : null,
    });
  }

  @Delete(':id')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN)
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.registrationsService.remove(tenantId, id);
  }
}
