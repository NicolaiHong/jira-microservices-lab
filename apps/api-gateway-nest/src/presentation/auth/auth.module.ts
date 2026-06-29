import { Module } from '@nestjs/common';
import { LoginUseCase } from '../../application/auth/login.use-case';
import { RegisterUseCase } from '../../application/auth/register.use-case';
import {
  IAM_SERVICE_PORT,
  IIamServicePort,
} from '../../domain/ports/iam-service.port';
import {
  IRateLimiterPort,
  RATE_LIMITER_PORT,
} from '../../domain/ports/rate-limiter.port';
import { IamServiceAdapter } from '../../infrastructure/http-clients/iam-service.adapter';
import { RedisRateLimitAdapter } from '../../infrastructure/rate-limit/redis-rate-limit.adapter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    JwtAuthGuard,
    {
      provide: IAM_SERVICE_PORT,
      useClass: IamServiceAdapter,
    },
    {
      provide: RATE_LIMITER_PORT,
      useClass: RedisRateLimitAdapter,
    },
    {
      provide: RegisterUseCase,
      useFactory: (
        iamService: IIamServicePort,
        rateLimiter: IRateLimiterPort,
      ) => new RegisterUseCase(iamService, rateLimiter),
      inject: [IAM_SERVICE_PORT, RATE_LIMITER_PORT],
    },
    {
      provide: LoginUseCase,
      useFactory: (
        iamService: IIamServicePort,
        rateLimiter: IRateLimiterPort,
      ) => new LoginUseCase(iamService, rateLimiter),
      inject: [IAM_SERVICE_PORT, RATE_LIMITER_PORT],
    },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
