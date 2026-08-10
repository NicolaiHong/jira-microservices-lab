import { Module } from '@nestjs/common';
import { ProjectServiceAdapter } from '../../infrastructure/http-clients/project-service.adapter';
import { ProjectsService } from '../../services/projects.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [
    ProjectServiceAdapter,
    ProjectsService,
  ],
})
export class ProjectsModule {}
