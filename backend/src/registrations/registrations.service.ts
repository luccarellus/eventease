import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

function normalizeCity(city?: string | null): string {
  if (!city) return '';
  return city
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class RegistrationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.InscricaoEventoUncheckedCreateInput) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: data.eventoId as string },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    if (!evento.publicado) {
      throw new BadRequestException('Este evento está inativo no momento.');
    }

    const now = new Date();
    if (evento.dataInicioInscricao && now < evento.dataInicioInscricao) {
      throw new BadRequestException('As inscrições para este evento ainda não começaram.');
    }

    if (evento.dataFimInscricao && now > evento.dataFimInscricao) {
      throw new BadRequestException('As inscrições para este evento já foram encerradas.');
    }

    const participante = await this.prisma.participante.findUnique({
      where: { id: data.participanteId as string },
    });

    if (!participante) {
      throw new NotFoundException('Participante não encontrado.');
    }

    const eventoCidade = (evento as any).cidade;
    if (eventoCidade && eventoCidade.trim() !== '') {
      const normEventoCidade = normalizeCity(eventoCidade);
      const normPartCidade = normalizeCity(participante.cidade);
      if (normEventoCidade !== normPartCidade) {
        throw new BadRequestException(
          `Inscrição não permitida: este evento é exclusivo para participantes de ${eventoCidade}. Seu cadastro pertence a ${participante.cidade}.`
        );
      }
    }

    const existing = await this.prisma.inscricaoEvento.findUnique({
      where: {
        unique_evento_participante: {
          eventoId: data.eventoId as string,
          participanteId: data.participanteId as string,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Participante já está inscrito neste evento.');
    }

    return this.prisma.inscricaoEvento.create({ data });
  }

  async checkRegistration(eventoId: string, participanteId: string) {
    const reg = await this.prisma.inscricaoEvento.findUnique({
      where: {
        unique_evento_participante: {
          eventoId,
          participanteId,
        },
      },
    });
    return { registered: !!reg };
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

  async findByEvent(eventoId: string) {
    return this.prisma.inscricaoEvento.findMany({
      where: { eventoId },
      include: { participante: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkIn(id: string) {
    return this.prisma.inscricaoEvento.update({
      where: { id },
      data: {
        presente: true,
        confirmado_em: new Date(),
      },
      include: {
        participante: true,
        evento: true,
      }
    });
  }

  async update(id: string, data: Prisma.InscricaoEventoUpdateInput) {
    return this.prisma.inscricaoEvento.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.inscricaoEvento.delete({
      where: { id },
    });
  }
}
