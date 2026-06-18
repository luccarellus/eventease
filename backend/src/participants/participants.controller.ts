import { Controller, Get, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Prisma } from '@prisma/client';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  create(@Body() data: Prisma.ParticipanteCreateInput) {
    return this.participantsService.create(data);
  }

  @Get('email/:email')
  findByEmail(@Param('email') email: string) {
    return this.participantsService.findByEmail(email);
  }

  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.participantsService.findByCode(code);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.participantsService.findAll();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.participantsService.remove(id);
  }
}
