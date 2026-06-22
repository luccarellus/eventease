import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('EventEase E2E Test Suite', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Variáveis para guardar estado entre os testes
  let adminCookies: string[] = [];
  let testUserId: string;
  let testParticipantId: string;
  let testParticipantCode: string;
  let testEventId: string;
  let testRegistrationId: string;

  // Emails únicos para evitar colisão no banco de dados persistente
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const testUserEmail = `staff_test_${randomSuffix}@eventease.com`;
  const testUserPassword = 'password123';
  const testParticipantEmail = `student_test_${randomSuffix}@school.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Limpeza de registros criados pelo teste para manter a integridade do banco
    try {
      if (testRegistrationId) {
        await prisma.inscricaoEvento.delete({ where: { id: testRegistrationId } }).catch(() => {});
      }
      if (testEventId) {
        await prisma.evento.delete({ where: { id: testEventId } }).catch(() => {});
      }
      if (testParticipantId) {
        await prisma.participante.delete({ where: { id: testParticipantId } }).catch(() => {});
      }
      if (testUserId) {
        await prisma.adminUser.delete({ where: { id: testUserId } }).catch(() => {});
      }
    } catch (cleanupError) {
      console.warn('Erro ao limpar dados de teste:', cleanupError);
    }
    
    await prisma.$disconnect();
    await app.close();
  });

  // ==========================================
  // 1. Healthcheck
  // ==========================================
  describe('Healthcheck (/health)', () => {
    it('deve retornar status OK', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  // ==========================================
  // 2. Autenticação (Auth)
  // ==========================================
  describe('Autenticação (/auth)', () => {
    it('deve registrar um novo usuário com privilégio padrão (user)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testUserEmail,
          password: testUserPassword,
          fullName: 'Staff E2E Tester',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', testUserEmail);
      expect(response.body).toHaveProperty('role', 'user');
      testUserId = response.body.id;
    });

    it('deve rejeitar login com senha incorreta', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUserEmail,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('deve autenticar o usuário administrador do seed e reter os cookies', async () => {
      // O seed cria lucassantos.-@outlook.com com senha presidente123
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'lucassantos.-@outlook.com',
          password: 'presidente123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('role', 'admin');
      
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.length).toBeGreaterThan(0);
      adminCookies = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
    });

    it('deve permitir acesso a /auth/me usando cookies de administrador', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', adminCookies)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'lucassantos.-@outlook.com');
      expect(response.body.user).toHaveProperty('role', 'admin');
    });
  });

  // ==========================================
  // 3. Participantes
  // ==========================================
  describe('Participantes (/participants)', () => {
    it('deve permitir a criação pública de um participante (inscrição livre)', async () => {
      const generatedCode = `EVT-T${Math.floor(100000 + Math.random() * 900000)}`;
      const response = await request(app.getHttpServer())
        .post('/participants')
        .send({
          nome: 'Participante E2E Test',
          email: testParticipantEmail,
          telefone: '11999998888',
          cidade: 'São Paulo',
          escola: 'Escola Modelo E2E',
          gremio: 'Grêmio União',
          codigo: generatedCode,
          aceitou_termos: true,
          termos_aceitos_em: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', testParticipantEmail);
      expect(response.body).toHaveProperty('codigo', generatedCode);

      testParticipantId = response.body.id;
      testParticipantCode = response.body.codigo;
    });

    it('deve recuperar dados públicos simplificados por e-mail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/participants/email/${testParticipantEmail}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testParticipantId);
      expect(response.body).toHaveProperty('nome', 'Participante E2E Test');
      expect(response.body).toHaveProperty('codigo', testParticipantCode);
      // Não deve expor e-mail ou telefone para respeitar LGPD no endpoint público
      expect(response.body).not.toHaveProperty('telefone');
      expect(response.body).not.toHaveProperty('email');
    });

    it('deve recuperar dados públicos simplificados por código', async () => {
      const response = await request(app.getHttpServer())
        .get(`/participants/code/${testParticipantCode}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testParticipantId);
      expect(response.body).toHaveProperty('nome', 'Participante E2E Test');
    });

    it('deve rejeitar busca de todos os participantes se não for admin', async () => {
      await request(app.getHttpServer())
        .get('/participants')
        .expect(401);
    });

    it('deve listar todos os participantes quando autenticado como admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/participants')
        .set('Cookie', adminCookies)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 4. Eventos e Inscrições
  // ==========================================
  describe('Eventos e Inscrições (/events e /registrations)', () => {
    it('deve permitir criar um evento quando autenticado como admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Cookie', adminCookies)
        .send({
          titulo: 'Fórum de Liderança E2E Test',
          descricao: 'Descrição do evento de testes e2e',
          data: new Date(Date.now() + 86400000).toISOString(), // Amanhã
          local: 'Auditório Principal E2E',
          publicado: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('titulo', 'Fórum de Liderança E2E Test');
      testEventId = response.body.id;
    });

    it('deve listar eventos publicados na rota pública', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const testEvent = response.body.find((e: any) => e.id === testEventId);
      expect(testEvent).toBeDefined();
    });

    it('deve permitir registrar o participante no evento', async () => {
      const response = await request(app.getHttpServer())
        .post('/registrations')
        .send({
          eventoId: testEventId,
          participanteId: testParticipantId,
          presente: false,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('eventoId', testEventId);
      expect(response.body).toHaveProperty('participanteId', testParticipantId);
      expect(response.body).toHaveProperty('presente', false);
      testRegistrationId = response.body.id;
    });

    it('deve verificar status da inscrição de forma pública', async () => {
      const response = await request(app.getHttpServer())
        .get(`/registrations/check/${testEventId}/${testParticipantId}`)
        .expect(200);

      expect(response.body).toHaveProperty('registered', true);
    });

    it('deve permitir realizar check-in (presença) no evento como admin', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/registrations/${testRegistrationId}/checkin`)
        .set('Cookie', adminCookies)
        .expect(200);

      expect(response.body).toHaveProperty('presente', true);
      expect(response.body.confirmado_em).toBeDefined();
    });
  });
});
