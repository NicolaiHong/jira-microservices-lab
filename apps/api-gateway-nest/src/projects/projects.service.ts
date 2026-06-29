import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/errors/api.exception';
import { getCorrelationId } from '../common/errors/correlation-id';
import {
  AuthenticatedRequest,
  GatewayUser,
} from '../common/guards/authenticated-request';

interface ProjectServiceErrorResponse {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Injectable()
export class ProjectsService {
  private readonly projectServiceUrl = (
    process.env.PROJECT_SERVICE_URL ?? 'http://localhost:8082'
  ).replace(/\/+$/, '');

  createWorkspace(
    body: unknown,
    request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.forwardToProjectService('POST', '/internal/workspaces', body, request);
  }

  listWorkspaces(request: AuthenticatedRequest): Promise<unknown> {
    return this.forwardToProjectService('GET', '/internal/workspaces', undefined, request);
  }

  createProject(
    workspaceId: string,
    body: unknown,
    request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.forwardToProjectService(
      'POST',
      `/internal/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      body,
      request,
    );
  }

  private async forwardToProjectService(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    request: AuthenticatedRequest,
  ): Promise<unknown> {
    const user = this.requireUser(request);
    const correlationId = getCorrelationId(request);
    const hasRequestBody = method !== 'GET';

    try {
      const response = await fetch(`${this.projectServiceUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(hasRequestBody ? { 'content-type': 'application/json' } : {}),
          'x-authenticated-user-id': user.userId,
          'x-correlation-id': correlationId,
        },
        body: hasRequestBody ? JSON.stringify(body ?? {}) : undefined,
      });
      const responseBody = await this.parseJsonResponse(response);

      if (!response.ok) {
        throw new ApiException(
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
      if (error instanceof ApiException) {
        throw error;
      }

      throw new ApiException(
        503,
        'PROJECT_SERVICE_UNAVAILABLE',
        'Project service is unavailable',
      );
    }
  }

  private async parseJsonResponse(
    response: Response,
  ): Promise<ProjectServiceErrorResponse> {
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

  private requireUser(request: AuthenticatedRequest): GatewayUser {
    if (!request.user) {
      throw new ApiException(
        401,
        'UNAUTHORIZED',
        'Authentication token is required',
      );
    }

    return request.user;
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
