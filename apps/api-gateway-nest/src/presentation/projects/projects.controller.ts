import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CreateProjectUseCase } from '../../application/projects/create-project.use-case';
import { CreateWorkspaceUseCase } from '../../application/projects/create-workspace.use-case';
import { ListWorkspacesUseCase } from '../../application/projects/list-workspaces.use-case';
import { getCorrelationId } from '../common/errors/correlation-id';
import { AuthenticatedRequest } from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/workspaces')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly createWorkspaceUseCase: CreateWorkspaceUseCase,
    private readonly listWorkspacesUseCase: ListWorkspacesUseCase,
    private readonly createProjectUseCase: CreateProjectUseCase,
  ) {}

  @Post()
  createWorkspace(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.createWorkspaceUseCase.execute({
      body,
      authenticatedUserId: request.user?.userId,
      correlationId: getCorrelationId(request),
    });
  }

  @Get()
  listWorkspaces(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.listWorkspacesUseCase.execute({
      authenticatedUserId: request.user?.userId,
      correlationId: getCorrelationId(request),
    });
  }

  @Post(':workspaceId/projects')
  createProject(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.createProjectUseCase.execute({
      workspaceId,
      body,
      authenticatedUserId: request.user?.userId,
      correlationId: getCorrelationId(request),
    });
  }
}
