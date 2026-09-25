import type {
  Issue,
  IssueComment,
  IssueHistory,
  IssueStatus,
  ValidatedIssueTransition,
} from '../domain/issue';
import type { Epic, Sprint } from '../domain/planning';

export const ISSUE_REPOSITORY = Symbol('ISSUE_REPOSITORY');
export const PROJECT_ACCESS_PORT = Symbol('PROJECT_ACCESS_PORT');
export const PLANNING_REPOSITORY = Symbol('PLANNING_REPOSITORY');

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
  epicId: string | null;
  sprintId: string | null;
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

/**
 * A claimed event plus the W3C trace context of the request that wrote it.
 * The trace context is Kafka header metadata, never part of the envelope.
 */
export interface ClaimedOutboxEvent extends OutboxEvent {
  traceContext: Record<string, string> | null;
}

export interface IssueListFilter {
  status?: IssueStatus;
  assigneeUserId?: string;
  sprintId?: string;
  q?: string;
}

/** Keyset position of the last listed issue; `createdAt` keeps microseconds. */
export interface IssueListPosition {
  createdAt: string;
  id: string;
}

export interface IssueListPage {
  items: Issue[];
  next: IssueListPosition | null;
}

export interface IssueRepository {
  createIssue(data: NewIssueData): Promise<Issue>;
  listIssues(
    projectId: string,
    filter: IssueListFilter,
    after: IssueListPosition | null,
    limit: number,
  ): Promise<IssueListPage>;
  findIssue(issueId: string): Promise<Issue | null>;
  updateIssue(
    issue: Issue,
    expectedVersion: number,
    data: UpdateIssueData,
    actorUserId: string,
  ): Promise<Issue>;
  assignIssue(
    issue: Issue,
    expectedVersion: number,
    assigneeUserId: string | null,
    actorUserId: string,
  ): Promise<Issue>;
  transitionIssue(
    issue: Issue,
    expectedVersion: number,
    transition: ValidatedIssueTransition,
    actorUserId: string,
  ): Promise<Issue>;
  addComment(
    issue: Issue,
    authorUserId: string,
    body: string,
  ): Promise<IssueComment>;
  listComments(issueId: string): Promise<IssueComment[]>;
  listHistory(issueId: string): Promise<IssueHistory[]>;
  claimPendingEvents(limit: number): Promise<ClaimedOutboxEvent[]>;
  markEventsPublished(eventIds: string[]): Promise<void>;
  recordPublishFailure(
    eventId: string,
    error: string,
  ): Promise<{ attempts: number; abandoned: boolean }>;
  outboxStatus(): Promise<OutboxStatus>;
}

export interface OutboxStatus {
  pending: number;
  abandoned: number;
  oldestPendingSeconds: number | null;
}

export interface NewEpicData {
  projectId: string;
  name: string;
  color: string;
  startDate: string | null;
  targetDate: string | null;
}

export interface NewSprintData {
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface PlanningRepository {
  createEpic(data: NewEpicData): Promise<Epic>;
  listEpics(projectId: string): Promise<Epic[]>;
  findEpic(epicId: string): Promise<Epic | null>;
  updateEpic(epic: Epic, data: Omit<NewEpicData, 'projectId'>): Promise<Epic>;
  createSprint(data: NewSprintData): Promise<Sprint>;
  listSprints(projectId: string): Promise<Sprint[]>;
  findSprint(sprintId: string): Promise<Sprint | null>;
  completeSprint(sprint: Sprint): Promise<Sprint>;
}
