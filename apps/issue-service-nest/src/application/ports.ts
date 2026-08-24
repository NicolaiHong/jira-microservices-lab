import type { Issue, IssueComment, IssueHistory } from '../domain/issue';
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

export interface IssueRepository {
  createIssue(data: NewIssueData): Promise<Issue>;
  listIssues(projectId: string): Promise<Issue[]>;
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
