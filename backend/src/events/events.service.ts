import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.EventoCreateInput) {
    return this.prisma.evento.create({ data });
  }

  async findAll(publishedOnly: boolean = false) {
    return this.prisma.evento.findMany({
      where: publishedOnly ? { publicado: true } : undefined,
      orderBy: { data: 'asc' },
    });
  }

  async findOne(id: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado');
    return evento;
  }

  async update(id: string, data: Prisma.EventoUpdateInput) {
    return this.prisma.evento.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.evento.delete({
      where: { id },
    });
  }
}
