import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import type { Participante } from '@prisma/client';
import { throwUniqueConstraintError } from '../common/prisma-error.util';
import { NevaProService } from '../common/nevapro.service';
import { RedisService } from '../common/redis.service';
import { CACHE_KEYS, CACHE_TTL, safeParse } from '../common/cache.keys';

const PUBLIC_PARTICIPANT_SELECT = {
  id: true,
  nome: true,
  codigo: true,
  cidade: true,
} as const;

type PublicParticipant = Pick<Participante, 'id' | 'nome' | 'codigo' | 'cidade'>;

@Injectable()
export class ParticipantsService {
  constructor(
    private prisma: PrismaService,
    private nevaProService: NevaProService,
    private redis: RedisService,
  ) {}

  private async findByEmailQuery(
    tenantId: string,
    email: string,
    select?: Prisma.ParticipanteSelect,
  ) {
    const participant = await this.prisma.participante.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: 'insensitive' },
      },
      select,
    });

    if (!participant) {
      throw new NotFoundException('Participante não encontrado');
    }

    return participant;
  }

  private async findByCodeQuery(
    tenantId: string,
    codigo: string,
    select?: Prisma.ParticipanteSelect,
  ) {
    const participant = await this.prisma.participante.findFirst({
      where: { tenantId, codigo },
      select,
    });

    if (!participant) {
      throw new NotFoundException('Participante não encontrado');
    }

    return participant;
  }

  async create(tenantId: string, data: Omit<Prisma.ParticipanteUncheckedCreateInput, 'tenantId'>) {
    const email = data.email;
    const codigo = data.codigo;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.participante.findFirst({
          where: {
            tenantId,
            OR: [{ email: { equals: email, mode: 'insensitive' } }, { codigo }],
          },
          select: { id: true },
        });

        if (existing) {
          throw new ConflictException(
            'Participante com este código ou email já existe nesta organização.',
          );
        }

        return tx.participante.create({
          data: {
            ...data,
            tenantId,
          },
        });
      });

      // Novo participante altera a contagem do dashboard
      await this.redis.del(CACHE_KEYS.participantsCount(tenantId));

      // Sincronização fire-and-forget com NevaPro
      void this.nevaProService.sync({
        email: created.email,
        fullName: created.nome,
        city: created.cidade,
        school: created.escola,
        gremio: created.gremio ?? undefined,
      });

      return created;
    } catch (error) {
      return throwUniqueConstraintError(
        error,
        'Participante com este código ou email já existe nesta organização.',
      );
    }
  }

  async findAll(tenantId: string) {
    return this.prisma.participante.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPage(tenantId: string, page: number, limit: number, search: string) {
    const normalizedSearch = search.trim();

    const isMetricsCall = page === 1 && limit === 1 && !normalizedSearch;
    if (isMetricsCall) {
      const cached = safeParse<{
        items: Participante[];
        total: number;
        page: number;
        limit: number;
      }>(await this.redis.get(CACHE_KEYS.participantsCount(tenantId)));
      if (cached) return cached;
    }

    const where: Prisma.ParticipanteWhereInput = {
      tenantId,
      ...(normalizedSearch
        ? {
            OR: [
              { nome: { contains: normalizedSearch, mode: 'insensitive' } },
              { email: { contains: normalizedSearch, mode: 'insensitive' } },
              { codigo: { contains: normalizedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.participante.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.participante.count({ where }),
    ]);

    const result = { items, total, page, limit };

    if (isMetricsCall) {
      await this.redis.set(
        CACHE_KEYS.participantsCount(tenantId),
        JSON.stringify(result),
        CACHE_TTL.participantsCount,
      );
    }

    return result;
  }

  async findByEmail(tenantId: string, email: string) {
    return this.findByEmailQuery(tenantId, email);
  }

  async findByEmailPublic(tenantId: string, email: string): Promise<PublicParticipant> {
    const key = CACHE_KEYS.participantByEmail(tenantId, email);
    const cached = safeParse<PublicParticipant>(await this.redis.get(key));
    if (cached) return cached;

    const participant = await this.findByEmailQuery(
      tenantId,
      email,
      PUBLIC_PARTICIPANT_SELECT,
    );

    await this.redis.set(
      key,
      JSON.stringify(participant),
      CACHE_TTL.participantLookup,
    );
    return participant;
  }

  async findByCode(tenantId: string, codigo: string) {
    return this.findByCodeQuery(tenantId, codigo);
  }

  async findByCodePublic(tenantId: string, codigo: string): Promise<PublicParticipant> {
    const key = CACHE_KEYS.participantByCode(tenantId, codigo);
    const cached = safeParse<PublicParticipant>(await this.redis.get(key));
    if (cached) return cached;

    const participant = await this.findByCodeQuery(
      tenantId,
      codigo,
      PUBLIC_PARTICIPANT_SELECT,
    );

    await this.redis.set(
      key,
      JSON.stringify(participant),
      CACHE_TTL.participantLookup,
    );
    return participant;
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.participante.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Participante não encontrado nesta organização.');
    }

    const removed = await this.prisma.participante.delete({
      where: { id },
    });

    await this.redis.del(CACHE_KEYS.participantsCount(tenantId));
    await this.redis.del(CACHE_KEYS.participantByEmail(tenantId, removed.email));
    await this.redis.del(CACHE_KEYS.participantByCode(tenantId, removed.codigo));

    return removed;
  }
}
