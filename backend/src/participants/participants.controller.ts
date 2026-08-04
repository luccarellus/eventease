import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ParticipantsService } from './participants.service';
import { AdminRoute } from '../auth/decorators/admin-route.decorator';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { Throttle } from '@nestjs/throttler';
import {
  ParticipantCodeLookupDto,
  ParticipantEmailLookupDto,
} from './dto/participant-lookup.dto';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecaptchaService } from '../common/recaptcha.service';

class ParticipantListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search = '';
}

@Controller('participants')
export class ParticipantsController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  /**
   * Endpoint público para criar participante (inscrição inicial no evento).
   * Não requer autenticação pois é usado pelo formulário de inscrição público.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() data: CreateParticipantDto, @Req() request: Request) {
    await this.recaptchaService.verify(
      data.recaptchaToken,
      'participant_create',
      request.ip,
    );

    // LGPD: o consentimento é obrigatório para cadastro público.
    if (data.aceitou_termos !== true) {
      throw new BadRequestException(
        'É obrigatório aceitar os termos de uso e a política de privacidade.',
      );
    }

    const { recaptchaToken: _recaptchaToken, ...participant } = data;
    return this.participantsService.create(participant);
  }

  /**
   * Busca pública por e-mail — retorna apenas os dados mínimos necessários (id, nome, codigo).
   * Usado para verificar cadastro antes de inscrição e buscar credencial.
   */
  @Get('email/:email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async findByEmail(
    @Param() params: ParticipantEmailLookupDto,
    @Headers('x-recaptcha-token') recaptchaToken: string | undefined,
    @Req() request: Request,
  ) {
    await this.recaptchaService.verify(
      recaptchaToken,
      'participant_lookup',
      request.ip,
    );
    return this.participantsService.findByEmailPublic(params.email);
  }

  /**
   * Busca pública por código — retorna apenas os dados mínimos necessários (id, nome, codigo).
   * Usado no check-in e na recuperação de credencial.
   */
  @Get('code/:code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async findByCode(
    @Param() params: ParticipantCodeLookupDto,
    @Headers('x-recaptcha-token') recaptchaToken: string | undefined,
    @Req() request: Request,
  ) {
    await this.recaptchaService.verify(
      recaptchaToken,
      'participant_lookup',
      request.ip,
    );
    return this.participantsService.findByCodePublic(params.code);
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
  findAll(@Query() query: ParticipantListQueryDto) {
    return this.participantsService.findPage(
      query.page,
      query.limit,
      query.search,
    );
  }

  @Delete(':id')
  @AdminRoute()
  remove(@Param('id') id: string) {
    return this.participantsService.remove(id);
  }
}
