import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from '../../services/projects.service';
import { getCorrelationId } from '../common/errors/correlation-id';
import { AuthenticatedRequest } from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('workspaces')
  createWorkspace(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.createWorkspace(body, request.user?.userId, getCorrelationId(request));
  }

  @Get('workspaces')
  listWorkspaces(@Req() request: AuthenticatedRequest): Promise<unknown> {
    return this.projectsService.listWorkspaces(request.user?.userId, getCorrelationId(request));
  }

  @Post('workspaces/:workspaceId/projects')
  createProject(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.createProject(workspaceId, body, request.user?.userId, getCorrelationId(request));
  }

  @Post('workspaces/:workspaceId/members')
  addWorkspaceMember(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.addWorkspaceMember(workspaceId, body, request.user?.userId, getCorrelationId(request));
  }

  @Patch('workspaces/:workspaceId/members/:userId')
  changeWorkspaceMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.changeWorkspaceMemberRole(workspaceId, userId, body, request.user?.userId, getCorrelationId(request));
  }

  @Delete('workspaces/:workspaceId/members/:userId')
  @HttpCode(204)
  removeWorkspaceMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.projectsService.removeWorkspaceMember(workspaceId, userId, request.user?.userId, getCorrelationId(request));
  }

  @Get('workspaces/:workspaceId/projects')
  listProjects(
    @Param('workspaceId') workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.listProjects(workspaceId, request.user?.userId, getCorrelationId(request));
  }

  @Get('projects/:projectId')
  getProject(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.getProject(projectId, request.user?.userId, getCorrelationId(request));
  }

  @Patch('projects/:projectId')
  updateProject(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.projectsService.updateProject(projectId, body, request.user?.userId, getCorrelationId(request));
  }

  @Delete('projects/:projectId')
  @HttpCode(204)
  archiveProject(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.projectsService.archiveProject(projectId, request.user?.userId, getCorrelationId(request));
  }
}
