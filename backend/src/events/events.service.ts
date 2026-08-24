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

  async create(tenantId: string, data: Omit<Prisma.EventoUncheckedCreateInput, 'tenantId'>) {
    const evento = await this.prisma.evento.create({
      data: {
        ...data,
        tenantId,
      },
    });
    await this.invalidateListCache(tenantId);
    return evento;
  }

  async findAll(tenantId: string, publishedOnly: boolean = false): Promise<Evento[]> {
    const key = publishedOnly
      ? CACHE_KEYS.eventsPublished(tenantId)
      : CACHE_KEYS.eventsAll(tenantId);
    const ttl = publishedOnly ? CACHE_TTL.events : CACHE_TTL.eventsAdmin;

    try {
      const cached = safeParse<Evento[]>(await this.redis.get(key));
      if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch {
      // Ignora erro de leitura do Redis
    }

    const events = await this.prisma.evento.findMany({
      where: {
        tenantId,
        ...(publishedOnly ? { publicado: true } : {}),
      },
      orderBy: { data: 'asc' },
    });

    if (events && events.length > 0) {
      await this.redis.set(key, JSON.stringify(events), ttl).catch(() => {});
    }

    return events;
  }

  async findOne(tenantId: string, id: string) {
    const key = CACHE_KEYS.eventById(tenantId, id);
    const cached = safeParse<Evento>(await this.redis.get(key));
    if (cached) return cached;

    const evento = await this.prisma.evento.findFirst({
      where: { id, tenantId },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado');

    await this.redis.set(key, JSON.stringify(evento), CACHE_TTL.events);
    return evento;
  }

  async update(tenantId: string, id: string, data: Prisma.EventoUpdateInput) {
    await this.findOne(tenantId, id);

    const evento = await this.prisma.evento.update({
      where: { id },
      data,
    });
    await this.invalidateListCache(tenantId, id);
    return evento;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const evento = await this.prisma.evento.delete({
      where: { id },
    });
    await this.invalidateListCache(tenantId, id);
    return evento;
  }

  /** Invalida as listas e detalhes de eventos do tenant especificado. */
  private async invalidateListCache(tenantId: string, id?: string) {
    await this.redis.del(CACHE_KEYS.eventsPublished(tenantId));
    await this.redis.del(CACHE_KEYS.eventsAll(tenantId));
    if (id) {
      await this.redis.del(CACHE_KEYS.eventById(tenantId, id));
    }
  }
}
