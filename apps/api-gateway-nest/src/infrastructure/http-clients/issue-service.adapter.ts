import { Injectable } from '@nestjs/common';
import { InternalServiceHttpClient, RequestContext } from './internal-service-http.client';

@Injectable()
export class IssueServiceAdapter {
  private readonly client = new InternalServiceHttpClient({
    service: 'issue-service',
    baseUrl: process.env.ISSUE_SERVICE_URL ?? 'http://localhost:8083',
    requestErrorCode: 'ISSUE_REQUEST_FAILED',
    requestErrorMessage: 'Issue service request failed',
    unavailableCode: 'ISSUE_SERVICE_UNAVAILABLE',
    unavailableMessage: 'Issue service is unavailable',
  });

  createIssue(projectId: string, body: unknown, context: RequestContext) {
    return this.client.forward('POST', `/internal/projects/${this.id(projectId)}/issues`, body, context);
  }
  // The query string is forwarded unchanged; Issue Service validates it (ADR 0005).
  listIssues(projectId: string, query: string, context: RequestContext) {
    const search = query ? `?${query}` : '';
    return this.client.forward('GET', `/internal/projects/${this.id(projectId)}/issues${search}`, undefined, context);
  }
  getIssue(issueId: string, context: RequestContext) {
    return this.client.forward('GET', `/internal/issues/${this.id(issueId)}`, undefined, context);
  }
  updateIssue(issueId: string, body: unknown, context: RequestContext) {
    return this.client.forward('PATCH', `/internal/issues/${this.id(issueId)}`, body, context);
  }
  assignIssue(issueId: string, body: unknown, context: RequestContext) {
    return this.client.forward('PATCH', `/internal/issues/${this.id(issueId)}/assignee`, body, context);
  }
  transitionIssue(issueId: string, body: unknown, context: RequestContext) {
    return this.client.forward('POST', `/internal/issues/${this.id(issueId)}/transitions`, body, context);
  }
  addComment(issueId: string, body: unknown, context: RequestContext) {
    return this.client.forward('POST', `/internal/issues/${this.id(issueId)}/comments`, body, context);
  }
  listComments(issueId: string, context: RequestContext) {
    return this.client.forward('GET', `/internal/issues/${this.id(issueId)}/comments`, undefined, context);
  }
  listHistory(issueId: string, context: RequestContext) {
    return this.client.forward('GET', `/internal/issues/${this.id(issueId)}/history`, undefined, context);
  }
  listEpics(projectId: string, context: RequestContext) {
    return this.client.forward('GET', `/internal/projects/${this.id(projectId)}/epics`, undefined, context);
  }
  createEpic(projectId: string, body: unknown, context: RequestContext) {
    return this.client.forward('POST', `/internal/projects/${this.id(projectId)}/epics`, body, context);
  }
  updateEpic(epicId: string, body: unknown, context: RequestContext) {
    return this.client.forward('PATCH', `/internal/epics/${this.id(epicId)}`, body, context);
  }
  listSprints(projectId: string, context: RequestContext) {
    return this.client.forward('GET', `/internal/projects/${this.id(projectId)}/sprints`, undefined, context);
  }
  createSprint(projectId: string, body: unknown, context: RequestContext) {
    return this.client.forward('POST', `/internal/projects/${this.id(projectId)}/sprints`, body, context);
  }
  completeSprint(sprintId: string, context: RequestContext) {
    return this.client.forward('POST', `/internal/sprints/${this.id(sprintId)}/complete`, undefined, context);
  }

  private id(value: string): string {
    return encodeURIComponent(value);
  }
}
