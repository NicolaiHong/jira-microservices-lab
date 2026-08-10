import { Injectable, Logger } from '@nestjs/common';
import type {
  ProjectAccessContext,
  ProjectAccessPort,
} from '../application/ports';
import { DomainError } from '../domain/errors';

@Injectable()
export class ProjectAccessHttpClient implements ProjectAccessPort {
  private readonly logger = new Logger(ProjectAccessHttpClient.name);
  private readonly baseUrl = (
    process.env.PROJECT_SERVICE_URL ?? 'http://localhost:8082'
  ).replace(/\/+$/, '');

  async getAccess(
    projectId: string,
    userId: string,
    correlationId: string,
  ): Promise<ProjectAccessContext> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.HTTP_CLIENT_TIMEOUT_MS ?? 3000),
    );
    const startedAt = Date.now();
    try {
      const response = await fetch(
        `${this.baseUrl}/internal/projects/${encodeURIComponent(projectId)}/access-context`,
        {
          signal: controller.signal,
          headers: {
            accept: 'application/json',
            'x-authenticated-user-id': userId,
            'x-correlation-id': correlationId,
          },
        },
      );
      const body = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      this.logger.log(
        JSON.stringify({
          service: 'issue-service',
          correlationId,
          downstreamService: 'project-service',
          status: response.status,
          durationMs: Date.now() - startedAt,
        }),
      );
      if (!response.ok) {
        throw new DomainError(
          response.status,
          typeof body.code === 'string' ? body.code : 'PROJECT_ACCESS_FAILED',
          typeof body.message === 'string'
            ? body.message
            : 'Project access check failed',
        );
      }
      return body as unknown as ProjectAccessContext;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw new DomainError(
        503,
        'PROJECT_SERVICE_UNAVAILABLE',
        'Project service is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
