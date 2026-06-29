import { Module } from '@nestjs/common';
import { CreateProjectUseCase } from '../../application/projects/create-project.use-case';
import { CreateWorkspaceUseCase } from '../../application/projects/create-workspace.use-case';
import { ListWorkspacesUseCase } from '../../application/projects/list-workspaces.use-case';
import {
  IProjectServicePort,
  PROJECT_SERVICE_PORT,
} from '../../domain/ports/project-service.port';
import { ProjectServiceAdapter } from '../../infrastructure/http-clients/project-service.adapter';
import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [
    {
      provide: PROJECT_SERVICE_PORT,
      useClass: ProjectServiceAdapter,
    },
    {
      provide: CreateWorkspaceUseCase,
      useFactory: (projectService: IProjectServicePort) =>
        new CreateWorkspaceUseCase(projectService),
      inject: [PROJECT_SERVICE_PORT],
    },
    {
      provide: ListWorkspacesUseCase,
      useFactory: (projectService: IProjectServicePort) =>
        new ListWorkspacesUseCase(projectService),
      inject: [PROJECT_SERVICE_PORT],
    },
    {
      provide: CreateProjectUseCase,
      useFactory: (projectService: IProjectServicePort) =>
        new CreateProjectUseCase(projectService),
      inject: [PROJECT_SERVICE_PORT],
    },
  ],
})
export class ProjectsModule {}
