import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import type { Evento } from '@prisma/client';
import { RedisService } from '../common/redis.service';
import { CACHE_KEYS, CACHE_TTL, safeParse } from '../common/cache.keys';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(data: Prisma.EventoCreateInput) {
    const evento = await this.prisma.evento.create({ data });
    await this.invalidateListCache();
    return evento;
  }

  async findAll(publishedOnly: boolean = false): Promise<Evento[]> {
    const key = publishedOnly
      ? CACHE_KEYS.eventsPublished
      : CACHE_KEYS.eventsAll;
    const ttl = publishedOnly ? CACHE_TTL.events : CACHE_TTL.eventsAdmin;

    const cached = safeParse<Evento[]>(await this.redis.get(key));
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;

    const events = await this.prisma.evento.findMany({
      where: publishedOnly ? { publicado: true } : undefined,
      orderBy: { data: 'asc' },
    });

    await this.redis.set(key, JSON.stringify(events), ttl);
    return events;
  }

  async findOne(id: string) {
    const key = CACHE_KEYS.eventById(id);
    const cached = safeParse<Evento>(await this.redis.get(key));
    if (cached) return cached;

    const evento = await this.prisma.evento.findUnique({
      where: { id },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado');

    await this.redis.set(key, JSON.stringify(evento), CACHE_TTL.events);
    return evento;
  }

  async update(id: string, data: Prisma.EventoUpdateInput) {
    const evento = await this.prisma.evento.update({
      where: { id },
      data,
    });
    await this.invalidateListCache(id);
    return evento;
  }

  async remove(id: string) {
    const evento = await this.prisma.evento.delete({
      where: { id },
    });
    await this.invalidateListCache(id);
    return evento;
  }

  /** Invalida as listas e detalhes de eventos sempre que algo muda. */
  private async invalidateListCache(id?: string) {
    await this.redis.del(CACHE_KEYS.eventsPublished);
    await this.redis.del(CACHE_KEYS.eventsAll);
    if (id) {
      await this.redis.del(CACHE_KEYS.eventById(id));
    }
  }
}
