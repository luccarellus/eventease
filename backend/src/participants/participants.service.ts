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

// Dados mínimos expostos publicamente.
// ATENÇÃO: `codigo` é mantido para o fluxo de recuperação de credencial
// (o participante recupera o próprio código informando o e-mail).
// `email` e `telefone` NÃO são devolvidos (LGPD).
const PUBLIC_PARTICIPANT_SELECT = {
  id: true,
  nome: true,
  codigo: true,
  cidade: true,
} as const;

/** Forma pública retornada nas buscas de credencial (LGPD-safe). */
type PublicParticipant = Pick<Participante, 'id' | 'nome' | 'codigo' | 'cidade'>;

@Injectable()
export class ParticipantsService {
  constructor(
    private prisma: PrismaService,
    private nevaProService: NevaProService,
    private redis: RedisService,
  ) {}

  private async findByEmailQuery(
    email: string,
    select?: Prisma.ParticipanteSelect,
  ) {
    const participant = await this.prisma.participante.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select,
    });

    if (!participant) {
      throw new NotFoundException('Participante não encontrado');
    }

    return participant;
  }

  private async findByCodeQuery(
    codigo: string,
    select?: Prisma.ParticipanteSelect,
  ) {
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
    const email = data.email;
    const codigo = data.codigo;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.participante.findFirst({
          where: {
            OR: [{ email: { equals: email, mode: 'insensitive' } }, { codigo }],
          },
          select: { id: true },
        });

        if (existing) {
          throw new ConflictException(
            'Participante com este código ou email já existe.',
          );
        }

        return tx.participante.create({ data });
      });

      // Novo participante altera a contagem do dashboard
      await this.redis.del(CACHE_KEYS.participantsCount);

      // 🚀 Sincronização automática de novo participante com NevaPro (fire-and-forget)
      void this.nevaProService.sync({
        email: created.email,
        fullName: created.nome,
        city: created.cidade,
        school: created.escola,
        gremio: created.gremio ?? undefined,
      });

      return created;
    } catch (error) {
      // Converte violação de unicidade (P2002) em 409 Conflict
      return throwUniqueConstraintError(
        error,
        'Participante com este código ou email já existe.',
      );
    }
  }

  async findAll() {
    return this.prisma.participante.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPage(page: number, limit: number, search: string) {
    const normalizedSearch = search.trim();

    // Chamada de métricas do dashboard (page=1&limit=1 sem busca) — cacheada.
    const isMetricsCall = page === 1 && limit === 1 && !normalizedSearch;
    if (isMetricsCall) {
      const cached = safeParse<{
        items: Participante[];
        total: number;
        page: number;
        limit: number;
      }>(await this.redis.get(CACHE_KEYS.participantsCount));
      if (cached) return cached;
    }

    const where: Prisma.ParticipanteWhereInput = normalizedSearch
      ? {
          OR: [
            { nome: { contains: normalizedSearch, mode: 'insensitive' } },
            { email: { contains: normalizedSearch, mode: 'insensitive' } },
            { codigo: { contains: normalizedSearch, mode: 'insensitive' } },
          ],
        }
      : {};

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
        CACHE_KEYS.participantsCount,
        JSON.stringify(result),
        CACHE_TTL.participantsCount,
      );
    }

    return result;
  }

  async findByEmail(email: string) {
    return this.findByEmailQuery(email);
  }

  async findByEmailPublic(email: string): Promise<PublicParticipant> {
    const key = CACHE_KEYS.participantByEmail(email);
    const cached = safeParse<PublicParticipant>(
      await this.redis.get(key),
    );
    if (cached) return cached;

    const participant = await this.findByEmailQuery(
      email,
      PUBLIC_PARTICIPANT_SELECT,
    );

    // Só cacheia respostas positivas (não cacheia 404 para não bloquear cadastros novos)
    await this.redis.set(
      key,
      JSON.stringify(participant),
      CACHE_TTL.participantLookup,
    );
    return participant;
  }

  async findByCode(codigo: string) {
    return this.findByCodeQuery(codigo);
  }

  async findByCodePublic(codigo: string): Promise<PublicParticipant> {
    const key = CACHE_KEYS.participantByCode(codigo);
    const cached = safeParse<PublicParticipant>(
      await this.redis.get(key),
    );
    if (cached) return cached;

    const participant = await this.findByCodeQuery(
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

  async remove(id: string) {
    // P2025 (registro inexistente) é convertido em 404 pelo filtro global de exceções.
    const removed = await this.prisma.participante.delete({
      where: { id },
    });

    // Invalida cache de credencial e contagem do dashboard
    await this.redis.del(CACHE_KEYS.participantsCount);
    await this.redis.del(CACHE_KEYS.participantByEmail(removed.email));
    await this.redis.del(CACHE_KEYS.participantByCode(removed.codigo));

    return removed;
  }
}
