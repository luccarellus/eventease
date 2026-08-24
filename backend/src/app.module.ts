import * as dotenv from 'dotenv';
import * as path from 'path';
// Carrega o .env do diretório atual ou do diretório pai (raiz do monorepo)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { ParticipantsModule } from './participants/participants.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { TenantsModule } from './tenants/tenants.module';
import { RecaptchaModule } from './common/recaptcha.module';
import { NevaProModule } from './common/nevapro.module';
import { RedisModule } from './common/redis.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    RedisModule,
    RecaptchaModule,
    NevaProModule,
    AuthModule,
    TenantsModule,
    EventsModule,
    ParticipantsModule,
    RegistrationsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
