import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

interface ProjectServiceRequestContext {
  userId: string;
  correlationId: string;
}

interface ProjectServiceResponse {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Injectable()
export class ProjectServiceAdapter {
  private readonly logger = new Logger(ProjectServiceAdapter.name);
  private readonly projectServiceUrl = (
    process.env.PROJECT_SERVICE_URL ?? 'http://localhost:8082'
  ).replace(/\/+$/, '');

  createWorkspace(
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    return this.forwardToProjectService(
      'POST',
      '/internal/workspaces',
      body,
      context,
    );
  }

  listWorkspaces(context: ProjectServiceRequestContext): Promise<unknown> {
    return this.forwardToProjectService(
      'GET',
      '/internal/workspaces',
      undefined,
      context,
    );
  }

  createProject(
    workspaceId: string,
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    return this.forwardToProjectService(
      'POST',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      body,
      context,
    );
  }

  addWorkspaceMember(
    workspaceId: string,
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    return this.forwardToProjectService(
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
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    return this.forwardToProjectService(
      'PATCH',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      body,
      context,
    );
  }

  async removeWorkspaceMember(
    workspaceId: string,
    userId: string,
    context: ProjectServiceRequestContext,
  ): Promise<void> {
    await this.forwardToProjectService(
      'DELETE',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      undefined,
      context,
    );
  }

  listProjects(
    workspaceId: string,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    return this.forwardToProjectService(
      'GET',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      undefined,
      context,
    );
  }

  getProject(
    projectId: string,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    return this.forwardToProjectService(
      'GET',
      `/internal/projects/${encodeURIComponent(projectId)}`,
      undefined,
      context,
    );
  }

  updateProject(
    projectId: string,
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    return this.forwardToProjectService(
      'PATCH',
      `/internal/projects/${encodeURIComponent(projectId)}`,
      body,
      context,
    );
  }

  async archiveProject(
    projectId: string,
    context: ProjectServiceRequestContext,
  ): Promise<void> {
    await this.forwardToProjectService(
      'DELETE',
      `/internal/projects/${encodeURIComponent(projectId)}`,
      undefined,
      context,
    );
  }

  private async forwardToProjectService(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    const hasRequestBody = method === 'POST' || method === 'PATCH';
    const controller = new AbortController();
    const timeoutMs = Number(process.env.HTTP_CLIENT_TIMEOUT_MS ?? 3000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${this.projectServiceUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(hasRequestBody ? { 'content-type': 'application/json' } : {}),
          'x-authenticated-user-id': context.userId,
          'x-correlation-id': context.correlationId,
        },
        body: hasRequestBody ? JSON.stringify(body ?? {}) : undefined,
      });
      const responseBody = await this.parseJsonResponse(response);

      this.logger.log(
        JSON.stringify({
          service: 'api-gateway',
          correlationId: context.correlationId,
          downstreamService: 'project-service',
          downstreamPath: path,
          status: response.status,
          durationMs: Date.now() - startedAt,
        }),
      );

      if (!response.ok) {
        throw new AppException(
          response.status,
          this.stringOrDefault(responseBody.code, 'INTERNAL_ERROR'),
          this.stringOrDefault(
            responseBody.message,
            'Project service request failed',
          ),
          this.objectOrEmpty(responseBody.details),
        );
      }

      return responseBody;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      throw new AppException(
        503,
        'PROJECT_SERVICE_UNAVAILABLE',
        'Project service is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseJsonResponse(
    response: Response,
  ): Promise<ProjectServiceResponse> {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(text);
      return this.isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private stringOrDefault(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }

  private objectOrEmpty(value: unknown): Record<string, unknown> {
    return this.isObject(value) ? value : {};
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
