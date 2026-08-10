import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ProjectServiceAdapter } from '../infrastructure/http-clients/project-service.adapter';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectClient: ProjectServiceAdapter) {}

  createWorkspace(body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.createWorkspace(body, this.context(userId, correlationId));
  }
  listWorkspaces(userId: string | undefined, correlationId: string) {
    return this.projectClient.listWorkspaces(this.context(userId, correlationId));
  }
  createProject(workspaceId: string, body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.createProject(workspaceId, body, this.context(userId, correlationId));
  }
  addWorkspaceMember(workspaceId: string, body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.addWorkspaceMember(workspaceId, body, this.context(userId, correlationId));
  }
  changeWorkspaceMemberRole(workspaceId: string, memberId: string, body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.changeWorkspaceMemberRole(workspaceId, memberId, body, this.context(userId, correlationId));
  }
  removeWorkspaceMember(workspaceId: string, memberId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.removeWorkspaceMember(workspaceId, memberId, this.context(userId, correlationId));
  }
  listProjects(workspaceId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.listProjects(workspaceId, this.context(userId, correlationId));
  }
  getProject(projectId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.getProject(projectId, this.context(userId, correlationId));
  }
  updateProject(projectId: string, body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.updateProject(projectId, body, this.context(userId, correlationId));
  }
  archiveProject(projectId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.archiveProject(projectId, this.context(userId, correlationId));
  }

  private context(userId: string | undefined, correlationId: string) {
    if (!userId) throw new AppException(401, 'UNAUTHORIZED', 'Authentication token is required');
    return { userId, correlationId };
  }
}
