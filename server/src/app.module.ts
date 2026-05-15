import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { IssuesModule } from './issues/issues.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, AuthModule, IssuesModule],
  controllers: [HealthController],
})
export class AppModule {}
