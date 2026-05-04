import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { TenantMiddleware } from './modules/tenant/tenant.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ProjectsModule } from './modules/projects/projects.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { TraceLoggerService } from './common/logger/trace-loger.service';
import { HealthModule } from './common/health/health.module';
import { AuthController } from './modules/auth/auth.controller';
import { ProjectsController } from './modules/projects/project.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    TenantModule,
    AuthModule,
    ProjectsModule,
    MetricsModule,
    HealthModule,
  ],
  providers: [
    TraceLoggerService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes(AuthController, ProjectsController);
  }
}
