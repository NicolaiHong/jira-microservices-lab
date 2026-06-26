import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { ProtectedModule } from './protected/protected.module';

@Module({
  imports: [HealthModule, AuthModule, ProtectedModule],
})
export class AppModule {}
