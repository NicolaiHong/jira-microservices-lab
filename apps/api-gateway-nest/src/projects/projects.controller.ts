import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@Controller('api/workspaces')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  createWorkspace(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.createWorkspace(body, request);
  }

  @Get()
  listWorkspaces(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.projectsService.listWorkspaces(request);
  }

  @Post(':workspaceId/projects')
  createProject(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.createProject(workspaceId, body, request);
  }
}
