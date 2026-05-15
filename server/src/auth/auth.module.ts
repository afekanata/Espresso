import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'dev-secret',
        signOptions: {
          expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Apply AuthGuard globally so the default posture is "auth required";
    // routes annotated with @Public() are exempted (login, health).
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
