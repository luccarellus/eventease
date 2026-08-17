import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check(@Res() res: Response) {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    let redisStatus: 'ok' | 'error' = 'ok';
    try {
      const isRedisOk = await this.redisService.ping();
      redisStatus = isRedisOk ? 'ok' : 'error';
    } catch {
      redisStatus = 'error';
    }

    const degraded = dbStatus === 'error' || redisStatus === 'error';
    res.status(degraded ? 503 : 200).json({
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      redis: redisStatus,
    });
  }
}
