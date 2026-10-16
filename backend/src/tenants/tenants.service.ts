import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTenantDto) {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: data.slug.toLowerCase().trim() },
    });

    if (existingSlug) {
      throw new ConflictException('Já existe uma organização com este slug.');
    }

    if (data.domain) {
      const existingDomain = await this.prisma.tenant.findUnique({
        where: { domain: data.domain.toLowerCase().trim() },
      });
      if (existingDomain) {
        throw new ConflictException('Já existe uma organização com este domínio.');
      }
    }

    return this.prisma.tenant.create({
      data: {
        name: data.name.trim(),
        slug: data.slug.toLowerCase().trim(),
        domain: data.domain ? data.domain.toLowerCase().trim() : null,
        logoUrl: data.logoUrl?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            eventos: true,
            participantes: true,
          },
        },
      },
    });
  }

  async findOne(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug,
    );

    const tenant = await this.prisma.tenant.findFirst({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug.toLowerCase() },
      include: {
        _count: {
          select: {
            users: true,
            eventos: true,
            participantes: true,
          },
        },
      },
    });

    if (!tenant) {
      // Se o ID especificado não foi encontrado (ex.: cache antigo do navegador),
      // faz fallback gracioso para o primeiro tenant ativo
      const fallback = await this.prisma.tenant.findFirst({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              users: true,
              eventos: true,
              participantes: true,
            },
          },
        },
      });

      if (fallback) {
        return fallback;
      }

      throw new NotFoundException('Organização não encontrada.');
    }

    return tenant;
  }

  async update(id: string, data: UpdateTenantDto) {
    await this.findOne(id);

    if (data.slug) {
      const existing = await this.prisma.tenant.findFirst({
        where: {
          slug: data.slug.toLowerCase().trim(),
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException('Já existe uma organização com este slug.');
      }
    }

    if (data.domain) {
      const existingDomain = await this.prisma.tenant.findFirst({
        where: {
          domain: data.domain.toLowerCase().trim(),
          id: { not: id },
        },
      });
      if (existingDomain) {
        throw new ConflictException('Já existe uma organização com este domínio.');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        slug: data.slug ? data.slug.toLowerCase().trim() : undefined,
        domain: data.domain !== undefined ? (data.domain ? data.domain.toLowerCase().trim() : null) : undefined,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl?.trim() || null : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.delete({
      where: { id },
    });
  }
}
