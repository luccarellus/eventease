import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { Prisma } from '@prisma/client';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  /**
   * Endpoint público para criar participante (inscrição inicial no evento).
   * Não requer autenticação pois é usado pelo formulário de inscrição público.
   */
  @Post()
  create(@Body() data: Prisma.ParticipanteCreateInput) {
    return this.participantsService.create(data);
  }

  /**
   * Busca pública por e-mail — retorna apenas os dados mínimos necessários (id, nome, codigo).
   * Usado para verificar cadastro antes de inscrição e buscar credencial.
   */
  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    return this.participantsService.findByEmailPublic(email);
  }

  /**
   * Busca pública por código — retorna apenas os dados mínimos necessários (id, nome, codigo).
   * Usado no check-in e na recuperação de credencial.
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.participantsService.findByCodePublic(code);
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

