import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

const PUBLIC_PARTICIPANT_SELECT = {
  id: true,
  nome: true,
  codigo: true,
  cidade: true,
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

    const created = await this.prisma.participante.create({ data });

    // 🚀 Sincronização automática de novo participante com NevaPro
    void this.syncToNevaPro({
      email: created.email,
      fullName: created.nome,
      city: (created as any).cidade,
      school: (created as any).escola,
      gremio: (created as any).gremio,
    });

    return created;
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
    try {
      return await this.prisma.participante.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException('Participante não encontrado para exclusão');
    }
  }

  private async syncToNevaPro(userData: { email: string; fullName?: string; city?: string; school?: string; gremio?: string }) {
    const webhookUrl = process.env.NEVAPRO_WEBHOOK_URL;
    const webhookSecret = process.env.NEVAPRO_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      console.warn('[NevaPro Sync] Variáveis NEVAPRO_WEBHOOK_URL ou NEVAPRO_WEBHOOK_SECRET não configuradas.');
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhookSecret,
        },
        body: JSON.stringify({
          email: userData.email,
          name: userData.fullName,
          city: userData.city,
          school: userData.school,
          gremio: userData.gremio,
        }),
      });

      const result = await response.json();
      console.log('[NevaPro Sync] Resultado:', result);
    } catch (err) {
      console.error('[NevaPro Sync] Erro ao sincronizar participante com NevaPro:', err);
    }
  }
}

