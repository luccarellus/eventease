import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Security and Validation E2E Test Suite', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testUserToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();

    // Create a mock token for a standard user (not an admin)
    testUserToken = await jwtService.signAsync({
      sub: 'regular-user-id',
      email: 'user@example.com',
      role: 'user',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ==========================================
  // 1. Validation Failures (DTO / class-validator)
  // ==========================================
  describe('Input Validation Constraints', () => {
    it('deve rejeitar cadastro de participante com e-mail inválido (400)', async () => {
      await request(app.getHttpServer())
        .post('/participants')
        .send({
          nome: 'Nome Valido',
          email: 'not-an-email',
          telefone: '1234567890',
          cidade: 'Cidade',
          escola: 'Escola',
        })
        .expect(400);
    });

    it('deve rejeitar cadastro de participante com nome muito curto (400)', async () => {
      await request(app.getHttpServer())
        .post('/participants')
        .send({
          nome: 'Ab',
          email: 'valid@example.com',
          telefone: '1234567890',
          cidade: 'Cidade',
          escola: 'Escola',
        })
        .expect(400);
    });

    it('deve rejeitar criação de evento com data malformada (400)', async () => {
      // Mocking admin headers using JWT sign
      const adminToken = await jwtService.signAsync({
        sub: 'admin-id',
        email: 'admin@example.com',
        role: 'admin',
      });

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          titulo: 'Forum',
          descricao: 'Desc',
          data: 'invalid-date-string',
          local: 'Auditório',
        })
        .expect(400);
    });
  });

  // ==========================================
  // 2. Authentication Guards
  // ==========================================
  describe('Route Protection and Authentication', () => {
    it('deve bloquear listagem de participantes sem autenticação (401)', async () => {
      await request(app.getHttpServer())
        .get('/participants')
        .expect(401);
    });

    it('deve bloquear criação de eventos sem autenticação (401)', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send({
          titulo: 'Test Event',
          data: new Date().toISOString(),
          local: 'Local',
        })
        .expect(401);
    });
  });

  // ==========================================
  // 3. Authorization Guards (Role check)
  // ==========================================
  describe('Role-Based Access Control', () => {
    it('deve bloquear acesso de role "user" a recursos de "admin" (403)', async () => {
      await request(app.getHttpServer())
        .get('/participants')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);
    });

    it('deve bloquear criação de evento por role "user" (403)', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          titulo: 'Test Event',
          data: new Date().toISOString(),
          local: 'Local',
        })
        .expect(403);
    });
  });

  // ==========================================
  // 4. Isolation of Admin Routes vs Public PII
  // ==========================================
  describe('Admin Search Isolation', () => {
    it('deve bloquear busca por email admin se não autenticado (401)', async () => {
      await request(app.getHttpServer())
        .get('/participants/admin/email/user@example.com')
        .expect(401);
    });

    it('deve bloquear busca por código admin para role "user" (403)', async () => {
      await request(app.getHttpServer())
        .get('/participants/admin/code/EVT-123456')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);
    });
  });
});
