import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { throwUniqueConstraintError } from '../common/prisma-error.util';

@Injectable()
export class RegistrationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.InscricaoEventoUncheckedCreateInput) {
    try {
      return await this.prisma.inscricaoEvento.create({ data });
    } catch (error) {
      throwUniqueConstraintError(error, 'Participante já está inscrito neste evento.');
    }
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
