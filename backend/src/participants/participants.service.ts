import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { throwUniqueConstraintError } from '../common/prisma-error.util';

// Campos retornados em endpoints públicos (minimização de dados - LGPD)
const PUBLIC_PARTICIPANT_SELECT = {
  id: true,
  nome: true,
  codigo: true,
} as const;

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ParticipanteCreateInput) {
    try {
      return await this.prisma.participante.create({ data });
    } catch (error) {
      throwUniqueConstraintError(error, 'Participante com este código ou email já existe.');
      throw error;
    }
  }

  async findAll() {
    return this.prisma.participante.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca por email para uso interno/admin — retorna dados completos.
   */
  async findByEmail(email: string) {
    const p = await this.prisma.participante.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!p) throw new NotFoundException('Participante não encontrado');
    return p;
  }

  /**
   * Busca por email para endpoints públicos — retorna apenas dados mínimos (LGPD).
   */
  async findByEmailPublic(email: string) {
    const p = await this.prisma.participante.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: PUBLIC_PARTICIPANT_SELECT,
    });
    if (!p) throw new NotFoundException('Participante não encontrado');
    return p;
  }

  /**
   * Busca por código para uso interno/admin — retorna dados completos.
   */
  async findByCode(codigo: string) {
    const p = await this.prisma.participante.findUnique({
      where: { codigo },
    });
    if (!p) throw new NotFoundException('Participante não encontrado');
    return p;
  }

  /**
   * Busca por código para endpoints públicos — retorna apenas dados mínimos (LGPD).
   */
  async findByCodePublic(codigo: string) {
    const p = await this.prisma.participante.findUnique({
      where: { codigo },
      select: PUBLIC_PARTICIPANT_SELECT,
    });
    if (!p) throw new NotFoundException('Participante não encontrado');
    return p;
  }

  async remove(id: string) {
    try {
      return await this.prisma.participante.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException('Participante não encontrado para exclusão');
    }
  }
}

