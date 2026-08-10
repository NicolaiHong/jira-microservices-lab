import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { IssueServiceAdapter } from '../infrastructure/http-clients/issue-service.adapter';

@Injectable()
export class IssuesService {
  constructor(private readonly issueClient: IssueServiceAdapter) {}

  createIssue(projectId: string, body: unknown, userId: string | undefined, correlationId: string) { return this.issueClient.createIssue(projectId, body, this.context(userId, correlationId)); }
  listIssues(projectId: string, userId: string | undefined, correlationId: string) { return this.issueClient.listIssues(projectId, this.context(userId, correlationId)); }
  getIssue(issueId: string, userId: string | undefined, correlationId: string) { return this.issueClient.getIssue(issueId, this.context(userId, correlationId)); }
  updateIssue(issueId: string, body: unknown, userId: string | undefined, correlationId: string) { return this.issueClient.updateIssue(issueId, body, this.context(userId, correlationId)); }
  assignIssue(issueId: string, body: unknown, userId: string | undefined, correlationId: string) { return this.issueClient.assignIssue(issueId, body, this.context(userId, correlationId)); }
  transitionIssue(issueId: string, body: unknown, userId: string | undefined, correlationId: string) { return this.issueClient.transitionIssue(issueId, body, this.context(userId, correlationId)); }
  addComment(issueId: string, body: unknown, userId: string | undefined, correlationId: string) { return this.issueClient.addComment(issueId, body, this.context(userId, correlationId)); }
  listComments(issueId: string, userId: string | undefined, correlationId: string) { return this.issueClient.listComments(issueId, this.context(userId, correlationId)); }
  listHistory(issueId: string, userId: string | undefined, correlationId: string) { return this.issueClient.listHistory(issueId, this.context(userId, correlationId)); }

  private context(userId: string | undefined, correlationId: string) {
    if (!userId) throw new AppException(401, 'UNAUTHORIZED', 'Authentication token is required');
    return { userId, correlationId };
  }
}
