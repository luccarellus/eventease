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
import { TenantId } from '../common/decorators/tenant.decorator';
import { Role } from '../auth/rbac.constants';

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
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async create(
    @TenantId() tenantId: string,
    @Body() data: CreateParticipantDto,
    @Req() request: Request,
  ) {
    await this.recaptchaService.verify(
      data.recaptchaToken,
      'participant_create',
      request.ip,
    );

    if (data.aceitou_termos !== true) {
      throw new BadRequestException(
        'É obrigatório aceitar os termos de uso e a política de privacidade.',
      );
    }

    const { recaptchaToken: _recaptchaToken, ...participant } = data;
    return this.participantsService.create(tenantId, participant);
  }

  /**
   * Busca pública por e-mail no tenant atual.
   */
  @Get('email/:email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async findByEmail(
    @TenantId() tenantId: string,
    @Param() params: ParticipantEmailLookupDto,
    @Headers('x-recaptcha-token') recaptchaToken: string | undefined,
    @Req() request: Request,
  ) {
    if (recaptchaToken) {
      await this.recaptchaService
        .verify(recaptchaToken, 'participant_lookup', request.ip)
        .catch(() => {});
    }
    return this.participantsService.findByEmailPublic(tenantId, params.email);
  }

  /**
   * Busca pública por código no tenant atual.
   */
  @Get('code/:code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async findByCode(
    @TenantId() tenantId: string,
    @Param() params: ParticipantCodeLookupDto,
    @Headers('x-recaptcha-token') recaptchaToken: string | undefined,
    @Req() request: Request,
  ) {
    if (recaptchaToken) {
      await this.recaptchaService
        .verify(recaptchaToken, 'participant_lookup', request.ip)
        .catch(() => {});
    }
    return this.participantsService.findByCodePublic(tenantId, params.code);
  }

  /**
   * Busca restrita por e-mail — perfil completo.
   */
  @Get('admin/email/:email')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF)
  async findByEmailAdmin(
    @TenantId() tenantId: string,
    @Param('email') email: string,
  ) {
    return this.participantsService.findByEmail(tenantId, email);
  }

  /**
   * Busca restrita por código — perfil completo.
   */
  @Get('admin/code/:code')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF)
  async findByCodeAdmin(
    @TenantId() tenantId: string,
    @Param('code') code: string,
  ) {
    return this.participantsService.findByCode(tenantId, code);
  }

  @Get()
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN, Role.ORGANIZER, Role.STAFF, Role.VIEWER)
  findAll(
    @TenantId() tenantId: string,
    @Query() query: ParticipantListQueryDto,
  ) {
    return this.participantsService.findPage(
      tenantId,
      query.page,
      query.limit,
      query.search,
    );
  }

  @Delete(':id')
  @AdminRoute(Role.SUPER_ADMIN, Role.ADMIN)
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.participantsService.remove(tenantId, id);
  }
}
