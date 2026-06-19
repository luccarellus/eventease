import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
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
  @AdminRoute()
  findAll() {
    return this.participantsService.findAll();
  }

  @Delete(':id')
  @AdminRoute()
  remove(@Param('id') id: string) {
    return this.participantsService.remove(id);
  }
}
