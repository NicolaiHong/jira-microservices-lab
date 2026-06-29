import { Injectable } from '@nestjs/common';
import { AppException } from '../../domain/errors/app.exception';
import type {
  IProjectServicePort,
  ProjectServiceRequestContext,
} from '../../domain/ports/project-service.port';

interface ProjectServiceResponse {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Injectable()
export class ProjectServiceAdapter implements IProjectServicePort {
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

  private async forwardToProjectService(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    const hasRequestBody = method !== 'GET';

    try {
      const response = await fetch(`${this.projectServiceUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(hasRequestBody ? { 'content-type': 'application/json' } : {}),
          'x-authenticated-user-id': context.userId,
          'x-correlation-id': context.correlationId,
        },
        body: hasRequestBody ? JSON.stringify(body ?? {}) : undefined,
      });
      const responseBody = await this.parseJsonResponse(response);

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
