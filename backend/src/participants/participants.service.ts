import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

const PUBLIC_PARTICIPANT_SELECT = {
  id: true,
  nome: true,
  codigo: true,
} as const;

@Injectable()
export class ParticipantsService {
  constructor(private prisma: PrismaService) {}

  private async findByEmailQuery(email: string, select?: Prisma.ParticipanteSelect) {
    const participant = await this.prisma.participante.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select,
    });

    if (!participant) {
      throw new NotFoundException('Participante não encontrado');
    }

    return participant;
  }

  private async findByCodeQuery(codigo: string, select?: Prisma.ParticipanteSelect) {
    const participant = await this.prisma.participante.findUnique({
      where: { codigo },
      select,
    });

    if (!participant) {
      throw new NotFoundException('Participante não encontrado');
    }

    return participant;
  }

  async create(data: Prisma.ParticipanteCreateInput) {
    const email = data.email as string;
    const codigo = data.codigo as string;

    const existing = await this.prisma.participante.findFirst({
      where: {
        OR: [{ email: { equals: email, mode: 'insensitive' } }, { codigo }],
      },
    });

    if (existing) {
      throw new ConflictException('Participante com este código ou email já existe.');
    }

    return this.prisma.participante.create({ data });
  }

  async findAll() {
    return this.prisma.participante.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmail(email: string) {
    return this.findByEmailQuery(email);
  }

  async findByEmailPublic(email: string) {
    return this.findByEmailQuery(email, PUBLIC_PARTICIPANT_SELECT);
  }

  async findByCode(codigo: string) {
    return this.findByCodeQuery(codigo);
  }

  async findByCodePublic(codigo: string) {
    return this.findByCodeQuery(codigo, PUBLIC_PARTICIPANT_SELECT);
  }

  async remove(id: string) {
    try {
      return await this.prisma.participante.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException('Participante não encontrado para exclusão');
    }
  }
}
