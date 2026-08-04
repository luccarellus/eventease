import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { throwUniqueConstraintError } from '../common/prisma-error.util';
import { NevaProService } from '../common/nevapro.service';

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

@Injectable()
export class ParticipantsService {
  constructor(
    private prisma: PrismaService,
    private nevaProService: NevaProService,
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

    return { items, total, page, limit };
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
    // P2025 (registro inexistente) é convertido em 404 pelo filtro global de exceções.
    return this.prisma.participante.delete({
      where: { id },
    });
  }
}
