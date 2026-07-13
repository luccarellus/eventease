import { Controller, Get, Post, Body, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  /**
   * Endpoint público para criar participante (inscrição inicial no evento).
   * Não requer autenticação pois é usado pelo formulário de inscrição público.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() data: CreateParticipantDto) {
    return this.participantsService.create(data);
  }

  /**
   * Busca pública por e-mail — retorna apenas os dados mínimos necessários (id, nome, codigo).
   * Usado para verificar cadastro antes de inscrição e buscar credencial.
   */
  @Get('email/:email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async findByEmail(@Param('email') email: string) {
    return this.participantsService.findByEmailPublic(email);
  }

  /**
   * Busca pública por código — retorna apenas os dados mínimos necessários (id, nome, codigo).
   * Usado no check-in e na recuperação de credencial.
   */
  @Get('code/:code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async findByCode(@Param('code') code: string) {
    return this.participantsService.findByCodePublic(code);
  }

  /**
   * Busca de participante por e-mail restrita a administradores — retorna perfil completo.
   */
  @Get('admin/email/:email')
  @AdminRoute()
  async findByEmailAdmin(@Param('email') email: string) {
    return this.participantsService.findByEmail(email);
  }

  /**
   * Busca de participante por código restrita a administradores — retorna perfil completo.
   */
  @Get('admin/code/:code')
  @AdminRoute()
  async findByCodeAdmin(@Param('code') code: string) {
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

