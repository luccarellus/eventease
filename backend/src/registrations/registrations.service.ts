import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { RedisService } from '../common/redis.service';
import { CACHE_KEYS, CACHE_TTL, safeParse } from '../common/cache.keys';

type InscricaoComParticipante = Prisma.InscricaoEventoGetPayload<{
  include: { participante: true };
}>;

@Injectable()
export class RegistrationsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(tenantId: string, data: Omit<Prisma.InscricaoEventoUncheckedCreateInput, 'tenantId'>) {
    const evento = await this.prisma.evento.findFirst({
      where: { id: data.eventoId, tenantId },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado nesta organização.');
    }

    if (!evento.publicado) {
      throw new BadRequestException(
        'Este evento está inativo momentaneamente.',
      );
    }

    const now = new Date();
    if (evento.dataInicioInscricao && now < evento.dataInicioInscricao) {
      throw new BadRequestException(
        'As inscrições para este evento ainda não começaram.',
      );
    }

    if (evento.dataFimInscricao && now > evento.dataFimInscricao) {
      throw new BadRequestException(
        'As inscrições para este evento já foram encerradas.',
      );
    }

    const participante = await this.prisma.participante.findFirst({
      where: { id: data.participanteId, tenantId },
    });

    if (!participante) {
      throw new NotFoundException('Participante não encontrado nesta organização.');
    }

    const existing = await this.prisma.inscricaoEvento.findUnique({
      where: {
        unique_evento_participante: {
          eventoId: data.eventoId,
          participanteId: data.participanteId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Participante já está inscrito neste evento.',
      );
    }

    const inscricao = await this.prisma.inscricaoEvento.create({
      data: {
        ...data,
        tenantId,
      },
    });

    await this.redis.del(CACHE_KEYS.registrationsByEvent(tenantId, data.eventoId));
    await this.redis.del(
      CACHE_KEYS.registrationCheck(tenantId, data.eventoId, data.participanteId),
    );
    return inscricao;
  }

  async checkRegistration(tenantId: string, eventoId: string, participanteId: string) {
    const key = CACHE_KEYS.registrationCheck(tenantId, eventoId, participanteId);
    const cached = safeParse<{ registered: boolean }>(
      await this.redis.get(key),
    );
    if (cached) return cached;

    const reg = await this.prisma.inscricaoEvento.findFirst({
      where: {
        tenantId,
        eventoId,
        participanteId,
      },
    });
    const result = { registered: !!reg };
    await this.redis.set(key, JSON.stringify(result), 30);
    return result;
  }

  async findAll(tenantId: string) {
    return this.prisma.inscricaoEvento.findMany({
      where: { tenantId },
      include: {
        participante: true,
        evento: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEvent(tenantId: string, eventoId: string): Promise<InscricaoComParticipante[]> {
    const key = CACHE_KEYS.registrationsByEvent(tenantId, eventoId);

    const cached = safeParse<InscricaoComParticipante[]>(
      await this.redis.get(key),
    );
    if (cached) return cached;

    const inscricoes = await this.prisma.inscricaoEvento.findMany({
      where: { tenantId, eventoId },
      include: { participante: true },
    });

    await this.redis.set(
      key,
      JSON.stringify(inscricoes),
      CACHE_TTL.registrationsByEvent,
    );
    return inscricoes;
  }

  async checkIn(tenantId: string, id: string) {
    const existing = await this.prisma.inscricaoEvento.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Inscrição não encontrada nesta organização.');
    }

    const inscricao = await this.prisma.inscricaoEvento.update({
      where: { id },
      data: {
        presente: true,
        confirmado_em: new Date(),
      },
      include: {
        participante: true,
        evento: true,
      },
    });

    await this.redis.del(CACHE_KEYS.registrationsByEvent(tenantId, inscricao.eventoId));
    return inscricao;
  }

  async update(tenantId: string, id: string, data: Prisma.InscricaoEventoUpdateInput) {
    const existing = await this.prisma.inscricaoEvento.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Inscrição não encontrada nesta organização.');
    }

    const inscricao = await this.prisma.inscricaoEvento.update({
      where: { id },
      data,
    });

    await this.redis.del(CACHE_KEYS.registrationsByEvent(tenantId, inscricao.eventoId));
    return inscricao;
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.inscricaoEvento.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Inscrição não encontrada nesta organização.');
    }

    const inscricao = await this.prisma.inscricaoEvento.delete({
      where: { id },
    });

    await this.redis.del(CACHE_KEYS.registrationsByEvent(tenantId, inscricao.eventoId));
    return inscricao;
  }
}
