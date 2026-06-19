import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { Prisma } from '@prisma/client';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post()
  create(@Body() data: Prisma.InscricaoEventoUncheckedCreateInput) {
    return this.registrationsService.create(data);
  }

  @Get('check/:eventoId/:participanteId')
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
  update(@Param('id') id: string, @Body() data: Prisma.InscricaoEventoUpdateInput) {
    return this.registrationsService.update(id, data);
  }

  @Delete(':id')
  @AdminRoute()
  remove(@Param('id') id: string) {
    return this.registrationsService.remove(id);
  }
}
