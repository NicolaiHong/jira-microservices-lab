import { Module } from '@nestjs/common';
import { IamServiceAdapter } from '../../infrastructure/http-clients/iam-service.adapter';
import { RedisRateLimitAdapter } from '../../infrastructure/rate-limit/redis-rate-limit.adapter';
import { AuthService } from '../../services/auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    JwtAuthGuard,
    IamServiceAdapter,
    RedisRateLimitAdapter,
    AuthService,
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
