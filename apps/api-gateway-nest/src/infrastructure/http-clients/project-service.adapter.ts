import { Injectable } from '@nestjs/common';
import { InternalServiceHttpClient, RequestContext } from './internal-service-http.client';

@Injectable()
export class ProjectServiceAdapter {
  private readonly client = new InternalServiceHttpClient({
    service: 'project-service',
    baseUrl: process.env.PROJECT_SERVICE_URL ?? 'http://localhost:8082',
    requestErrorCode: 'INTERNAL_ERROR',
    requestErrorMessage: 'Project service request failed',
    unavailableCode: 'PROJECT_SERVICE_UNAVAILABLE',
    unavailableMessage: 'Project service is unavailable',
    objectResponseOnly: true,
  });

  createWorkspace(
    body: unknown,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'POST',
      '/internal/workspaces',
      body,
      context,
    );
  }

  listWorkspaces(context: RequestContext): Promise<unknown> {
    return this.client.forward(
      'GET',
      '/internal/workspaces',
      undefined,
      context,
    );
  }

  createProject(
    workspaceId: string,
    body: unknown,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'POST',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      body,
      context,
    );
  }

  listWorkspaceMembers(
    workspaceId: string,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'GET',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/members`,
      undefined,
      context,
    );
  }

  addWorkspaceMember(
    workspaceId: string,
    body: unknown,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'POST',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/members`,
      body,
      context,
    );
  }

  changeWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    body: unknown,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'PATCH',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      body,
      context,
    );
  }

  async removeWorkspaceMember(
    workspaceId: string,
    userId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.client.forward(
      'DELETE',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      undefined,
      context,
    );
  }

  listProjects(
    workspaceId: string,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'GET',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      undefined,
      context,
    );
  }

  getProject(
    projectId: string,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'GET',
      `/internal/projects/${encodeURIComponent(projectId)}`,
      undefined,
      context,
    );
  }

  updateProject(
    projectId: string,
    body: unknown,
    context: RequestContext,
  ): Promise<unknown> {
    return this.client.forward(
      'PATCH',
      `/internal/projects/${encodeURIComponent(projectId)}`,
      body,
      context,
    );
  }

  async archiveProject(
    projectId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.client.forward(
      'DELETE',
      `/internal/projects/${encodeURIComponent(projectId)}`,
      undefined,
      context,
    );
  }

}
