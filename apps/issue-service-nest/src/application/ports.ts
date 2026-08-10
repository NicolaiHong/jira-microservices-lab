import type { Issue, IssueComment, IssueHistory } from '../domain/issue';

export const ISSUE_REPOSITORY = Symbol('ISSUE_REPOSITORY');
export const PROJECT_ACCESS_PORT = Symbol('PROJECT_ACCESS_PORT');

export interface ProjectAccessContext {
  projectId: string;
  workspaceId: string;
  projectKey: string;
  projectStatus: 'ACTIVE' | 'ARCHIVED';
  membershipRole: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface ProjectAccessPort {
  getAccess(
    projectId: string,
    userId: string,
    correlationId: string,
  ): Promise<ProjectAccessContext>;
}

export interface NewIssueData {
  projectId: string;
  projectKey: string;
  summary: string;
  description: string | null;
  type: string;
  priority: string;
  reporterUserId: string;
  assigneeUserId: string | null;
}

export interface UpdateIssueData {
  summary: string;
  description: string | null;
  type: string;
  priority: string;
}

export interface OutboxEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateVersion: number;
  projectId: string;
  actorUserId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface IssueRepository {
  createIssue(data: NewIssueData): Promise<Issue>;
  listIssues(projectId: string): Promise<Issue[]>;
  findIssue(issueId: string): Promise<Issue | null>;
  updateIssue(
    issue: Issue,
    data: UpdateIssueData,
    actorUserId: string,
  ): Promise<Issue>;
  assignIssue(
    issue: Issue,
    assigneeUserId: string | null,
    actorUserId: string,
  ): Promise<Issue>;
  transitionIssue(
    issue: Issue,
    status: string,
    actorUserId: string,
  ): Promise<Issue>;
  addComment(
    issue: Issue,
    authorUserId: string,
    body: string,
  ): Promise<IssueComment>;
  listComments(issueId: string): Promise<IssueComment[]>;
  listHistory(issueId: string): Promise<IssueHistory[]>;
  pendingEvents(limit: number): Promise<OutboxEvent[]>;
  markEventPublished(eventId: string): Promise<void>;
  recordPublishFailure(eventId: string): Promise<void>;
}
