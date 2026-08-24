import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';

interface ProjectServiceRequestContext {
  userId: string;
  correlationId: string;
}

@Injectable()
export class IssueServiceAdapter {
  private readonly logger = new Logger(IssueServiceAdapter.name);
  private readonly baseUrl = (
    process.env.ISSUE_SERVICE_URL ?? 'http://localhost:8083'
  ).replace(/\/+$/, '');
  private readonly internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET ?? '';

  createIssue(projectId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('POST', `/internal/projects/${this.id(projectId)}/issues`, body, context);
  }
  listIssues(projectId: string, context: ProjectServiceRequestContext) {
    return this.forward('GET', `/internal/projects/${this.id(projectId)}/issues`, undefined, context);
  }
  getIssue(issueId: string, context: ProjectServiceRequestContext) {
    return this.forward('GET', `/internal/issues/${this.id(issueId)}`, undefined, context);
  }
  updateIssue(issueId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('PATCH', `/internal/issues/${this.id(issueId)}`, body, context);
  }
  assignIssue(issueId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('PATCH', `/internal/issues/${this.id(issueId)}/assignee`, body, context);
  }
  transitionIssue(issueId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('POST', `/internal/issues/${this.id(issueId)}/transitions`, body, context);
  }
  addComment(issueId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('POST', `/internal/issues/${this.id(issueId)}/comments`, body, context);
  }
  listComments(issueId: string, context: ProjectServiceRequestContext) {
    return this.forward('GET', `/internal/issues/${this.id(issueId)}/comments`, undefined, context);
  }
  listHistory(issueId: string, context: ProjectServiceRequestContext) {
    return this.forward('GET', `/internal/issues/${this.id(issueId)}/history`, undefined, context);
  }
  listEpics(projectId: string, context: ProjectServiceRequestContext) {
    return this.forward('GET', `/internal/projects/${this.id(projectId)}/epics`, undefined, context);
  }
  createEpic(projectId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('POST', `/internal/projects/${this.id(projectId)}/epics`, body, context);
  }
  updateEpic(epicId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('PATCH', `/internal/epics/${this.id(epicId)}`, body, context);
  }
  listSprints(projectId: string, context: ProjectServiceRequestContext) {
    return this.forward('GET', `/internal/projects/${this.id(projectId)}/sprints`, undefined, context);
  }
  createSprint(projectId: string, body: unknown, context: ProjectServiceRequestContext) {
    return this.forward('POST', `/internal/projects/${this.id(projectId)}/sprints`, body, context);
  }
  completeSprint(sprintId: string, context: ProjectServiceRequestContext) {
    return this.forward('POST', `/internal/sprints/${this.id(sprintId)}/complete`, undefined, context);
  }

  private async forward(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.HTTP_CLIENT_TIMEOUT_MS ?? 3000),
    );
    const startedAt = Date.now();
    try {
      const hasBody = method !== 'GET';
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          'x-authenticated-user-id': context.userId,
          'x-correlation-id': context.correlationId,
          'x-internal-service-secret': this.internalServiceSecret,
        },
        body: hasBody ? JSON.stringify(body ?? {}) : undefined,
      });
      const parsed = await this.parse(response);
      this.logger.log(
        JSON.stringify({
          service: 'api-gateway',
          correlationId: context.correlationId,
          downstreamService: 'issue-service',
          downstreamPath: path,
          status: response.status,
          durationMs: Date.now() - startedAt,
        }),
      );
      if (!response.ok) {
        const error = parsed as Record<string, unknown>;
        throw new AppException(
          response.status,
          typeof error.code === 'string' ? error.code : 'ISSUE_REQUEST_FAILED',
          typeof error.message === 'string' ? error.message : 'Issue service request failed',
          this.object(error.details),
        );
      }
      return parsed;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(503, 'ISSUE_SERVICE_UNAVAILABLE', 'Issue service is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private id(value: string): string {
    return encodeURIComponent(value);
  }
}
