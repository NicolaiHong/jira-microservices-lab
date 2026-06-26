import { Module } from '@nestjs/common';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RateLimitService],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
