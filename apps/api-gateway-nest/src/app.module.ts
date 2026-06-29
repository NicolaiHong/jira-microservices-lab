import { Module } from '@nestjs/common';
import { AuthModule } from './presentation/auth/auth.module';
import { HealthModule } from './presentation/health/health.module';
import { ProjectsModule } from './presentation/projects/projects.module';
import { ProtectedModule } from './presentation/protected/protected.module';

@Module({
  imports: [HealthModule, AuthModule, ProtectedModule, ProjectsModule],
})
export class AppModule {}
