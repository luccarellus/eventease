import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { throwUniqueConstraintError } from '../common/prisma-error.util';

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.ParticipanteCreateInput) {
    try {
      return await this.prisma.participante.create({ data });
    } catch (error) {
      throwUniqueConstraintError(error, 'Participante com este código ou email já existe.');
    }
  }

  async findAll() {
    return this.prisma.participante.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmail(email: string) {
    const p = await this.prisma.participante.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!p) throw new NotFoundException('Participante não encontrado');
    return p;
  }

  async findByCode(codigo: string) {
    const p = await this.prisma.participante.findUnique({
      where: { codigo },
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
