import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from '../src/common/recaptcha.service';

describe('Security and Validation E2E Test Suite', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testUserToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // reCAPTCHA é um serviço externo — não deve ser chamado em testes e2e.
      .overrideProvider(RecaptchaService)
      .useValue({ verify: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestApplication();
    // A API é servida sob o prefixo /api (configuração de produção).
    app.setGlobalPrefix('api');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();

    // O JwtAuthGuard verifica a existência do usuário no banco — por isso os
    // usuários de teste precisam existir em admin_users.
    await prisma.adminUser.createMany({
      data: [
        { id: 'regular-user-id', email: 'user@example.com', role: 'user' },
        { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
      ],
      skipDuplicates: true,
    });

    // Create a mock token for a standard user (not an admin)
    testUserToken = await jwtService.signAsync({
      sub: 'regular-user-id',
      email: 'user@example.com',
      role: 'user',
    });
    adminToken = await jwtService.signAsync({
      sub: 'admin-id',
      email: 'admin@example.com',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await prisma.adminUser
      .deleteMany({
        where: { id: { in: ['regular-user-id', 'admin-id'] } },
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  // ==========================================
  // 1. Validation Failures (DTO / class-validator)
  // ==========================================
  describe('Input Validation Constraints', () => {
    it('deve rejeitar cadastro de participante com e-mail inválido (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/participants')
        .send({
          nome: 'Nome Valido',
          email: 'not-an-email',
          telefone: '1234567890',
          cidade: 'Cidade',
          escola: 'Escola',
          recaptchaToken: 'test-token',
        })
        .expect(400);
    });

    it('deve rejeitar cadastro de participante com nome muito curto (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/participants')
        .send({
          nome: 'Ab',
          email: 'valid@example.com',
          telefone: '1234567890',
          cidade: 'Cidade',
          escola: 'Escola',
          recaptchaToken: 'test-token',
        })
        .expect(400);
    });

    it('deve rejeitar criação de evento com data malformada (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/events')
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
      await request(app.getHttpServer()).get('/api/participants').expect(401);
    });

    it('deve bloquear criação de eventos sem autenticação (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/events')
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
        .get('/api/participants')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);
    });

    it('deve bloquear criação de evento por role "user" (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/events')
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
        .get('/api/participants/admin/email/user@example.com')
        .expect(401);
    });

    it('deve bloquear busca por código admin para role "user" (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/participants/admin/code/EVT-123456')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);
    });
  });
});
