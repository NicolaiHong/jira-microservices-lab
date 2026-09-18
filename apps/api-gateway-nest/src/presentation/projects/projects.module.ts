import { Module } from '@nestjs/common';
import { ProjectServiceAdapter } from '../../infrastructure/http-clients/project-service.adapter';
import { RedisRateLimitAdapter } from '../../infrastructure/rate-limit/redis-rate-limit.adapter';
import { ProjectsService } from '../../services/projects.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [
    ProjectServiceAdapter,
    RedisRateLimitAdapter,
    ProjectsService,
  ],
})
export class ProjectsModule {}
