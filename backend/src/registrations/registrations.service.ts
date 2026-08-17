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

  async create(data: Prisma.InscricaoEventoUncheckedCreateInput) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: data.eventoId },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
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

    const participante = await this.prisma.participante.findUnique({
      where: { id: data.participanteId },
    });

    if (!participante) {
      throw new NotFoundException('Participante não encontrado.');
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

    const inscricao = await this.prisma.inscricaoEvento.create({ data });
    await this.redis.del(CACHE_KEYS.registrationsByEvent(data.eventoId));
    await this.redis.del(
      CACHE_KEYS.registrationCheck(data.eventoId, data.participanteId),
    );
    return inscricao;
  }

  async checkRegistration(eventoId: string, participanteId: string) {
    const key = CACHE_KEYS.registrationCheck(eventoId, participanteId);
    const cached = safeParse<{ registered: boolean }>(
      await this.redis.get(key),
    );
    if (cached) return cached;

    const reg = await this.prisma.inscricaoEvento.findUnique({
      where: {
        unique_evento_participante: {
          eventoId,
          participanteId,
        },
      },
    });
    const result = { registered: !!reg };
    await this.redis.set(key, JSON.stringify(result), 30);
    return result;
  }

  async findAll() {
    return this.prisma.inscricaoEvento.findMany({
      include: {
        participante: true,
        evento: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEvent(eventoId: string): Promise<InscricaoComParticipante[]> {
    const key = CACHE_KEYS.registrationsByEvent(eventoId);

    const cached = safeParse<InscricaoComParticipante[]>(
      await this.redis.get(key),
    );
    if (cached) return cached;

    const inscricoes = await this.prisma.inscricaoEvento.findMany({
      where: { eventoId },
      include: { participante: true },
    });

    await this.redis.set(
      key,
      JSON.stringify(inscricoes),
      CACHE_TTL.registrationsByEvent,
    );
    return inscricoes;
  }

  async checkIn(id: string) {
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

    // Check-in muda o estado da lista de inscritos do evento
    await this.redis.del(CACHE_KEYS.registrationsByEvent(inscricao.eventoId));
    return inscricao;
  }

  async update(id: string, data: Prisma.InscricaoEventoUpdateInput) {
    const inscricao = await this.prisma.inscricaoEvento.update({
      where: { id },
      data,
    });

    await this.redis.del(CACHE_KEYS.registrationsByEvent(inscricao.eventoId));
    return inscricao;
  }

  async remove(id: string) {
    const inscricao = await this.prisma.inscricaoEvento.delete({
      where: { id },
    });

    await this.redis.del(CACHE_KEYS.registrationsByEvent(inscricao.eventoId));
    return inscricao;
  }
}
