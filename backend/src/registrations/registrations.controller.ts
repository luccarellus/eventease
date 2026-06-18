import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.registrationsService.findAll();
  }

  @Get('event/:eventoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findByEvent(@Param('eventoId') eventoId: string) {
    return this.registrationsService.findByEvent(eventoId);
  }

  @Patch(':id/checkin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  checkIn(@Param('id') id: string) {
    return this.registrationsService.checkIn(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() data: Prisma.InscricaoEventoUpdateInput) {
    return this.registrationsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.registrationsService.remove(id);
  }
}
