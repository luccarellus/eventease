import { Controller, Get, Post, Body, Param, Patch, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { Throttle } from '@nestjs/throttler';
import { toDateOrUndefined } from '../common/date.util';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  /**
   * Cria uma nova inscrição.
   * Nota: o frontend público usa este endpoint via cookie JWT do usuário logado ou anonimamente se cadastrando pela primeira vez.
   * Limitado contra abusos automatizados.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@Body() data: CreateRegistrationDto) {
    return this.registrationsService.create({
      eventoId: data.eventoId,
      participanteId: data.participanteId,
      presente: data.presente ?? false,
      confirmado_em: toDateOrUndefined(data.confirmado_em),
    });
  }

  @Get('check/:eventoId/:participanteId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  checkRegistration(
    @Param('eventoId') eventoId: string,
    @Param('participanteId') participanteId: string,
  ) {
    return this.registrationsService.checkRegistration(eventoId, participanteId);
  }

  @Get()
  @AdminRoute()
  findAll() {
    return this.registrationsService.findAll();
  }

  @Get('event/:eventoId')
  @AdminRoute()
  findByEvent(@Param('eventoId') eventoId: string) {
    return this.registrationsService.findByEvent(eventoId);
  }

  @Patch(':id/checkin')
  @AdminRoute()
  checkIn(@Param('id') id: string) {
    return this.registrationsService.checkIn(id);
  }

  @Patch(':id')
  @AdminRoute()
  update(@Param('id') id: string, @Body() data: UpdateRegistrationDto) {
    return this.registrationsService.update(id, {
      presente: data.presente,
      confirmado_em: toDateOrUndefined(data.confirmado_em),
    });
  }

  @Delete(':id')
  @AdminRoute()
  remove(@Param('id') id: string) {
    return this.registrationsService.remove(id);
  }
}
