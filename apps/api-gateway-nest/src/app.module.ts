import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { ProtectedModule } from './protected/protected.module';

@Module({
  imports: [HealthModule, AuthModule, ProtectedModule, ProjectsModule],
})
export class AppModule {}
