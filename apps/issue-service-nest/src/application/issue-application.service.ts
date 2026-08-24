import { Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPOSITORY,
  PLANNING_REPOSITORY,
  PROJECT_ACCESS_PORT,
  type IssueRepository,
  type ProjectAccessContext,
  type ProjectAccessPort,
  type PlanningRepository,
} from './ports';
import {
  concurrentIssueModification,
  DomainError,
  notFound,
  validationError,
} from '../domain/errors';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  assertTransition,
  enumValue,
  optionalText,
  optionalUuid,
  requiredText,
  uuid,
  type Issue,
  type IssuePriority,
  type IssueStatus,
  type IssueType,
} from '../domain/issue';

export interface RequestContext {
  userId: string;
  correlationId: string;
}

@Injectable()
export class IssueApplicationService {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly issues: IssueRepository,
    @Inject(PLANNING_REPOSITORY) private readonly planning: PlanningRepository,
    @Inject(PROJECT_ACCESS_PORT) private readonly projects: ProjectAccessPort,
  ) {}

  async createIssue(
    projectIdValue: string,
    body: unknown,
    context: RequestContext,
  ) {
    const projectId = uuid(projectIdValue, 'projectId');
    const input = this.body(body);
    const access = await this.requireWritableProject(projectId, context);
    const assigneeUserId = optionalUuid(input.assigneeUserId, 'assigneeUserId');
    const epicId = optionalUuid(input.epicId, 'epicId');
    const sprintId = optionalUuid(input.sprintId, 'sprintId');
    if (assigneeUserId) {
      await this.projects.getAccess(projectId, assigneeUserId, context.correlationId);
    }
    await this.assertPlanningLinks(projectId, epicId, sprintId);

    const issue = await this.issues.createIssue({
      projectId,
      projectKey: access.projectKey,
      summary: requiredText(input.summary, 'summary', 200),
      description: optionalText(input.description, 'description', 5000),
      type: enumValue(input.type, 'type', ISSUE_TYPES),
      priority: enumValue(input.priority, 'priority', ISSUE_PRIORITIES),
      reporterUserId: context.userId,
      assigneeUserId,
      epicId,
      sprintId,
    });
    return { issue };
  }

  async listIssues(
    projectIdValue: string,
    context: RequestContext,
  ) {
    const projectId = uuid(projectIdValue, 'projectId');
    await this.projects.getAccess(projectId, context.userId, context.correlationId);
    return { items: await this.issues.listIssues(projectId) };
  }

  async getIssue(issueIdValue: string, context: RequestContext) {
    return { issue: await this.requireVisibleIssue(issueIdValue, context) };
  }

  async updateIssue(
    issueIdValue: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.body(body);
    this.assertCorePatchFields(input);
    if (!this.hasCorePatchMutation(input)) {
      if (Object.prototype.hasOwnProperty.call(input, 'expectedVersion')) {
        this.expectedVersion(input);
      }
      return { issue: await this.requireVisibleIssue(issueIdValue, context) };
    }

    const expectedVersion = this.expectedVersion(input);
    const issue = await this.requireVisibleIssue(issueIdValue, context, true);
    this.assertExpectedVersion(issue, expectedVersion);
    const updated = await this.issues.updateIssue(
      issue,
      expectedVersion,
      {
        summary:
          input.summary === undefined
            ? issue.summary
            : requiredText(input.summary, 'summary', 200),
        description:
          input.description === undefined
            ? issue.description
            : optionalText(input.description, 'description', 5000),
        type:
          input.type === undefined
            ? issue.type
            : enumValue(input.type, 'type', ISSUE_TYPES),
        priority:
          input.priority === undefined
            ? issue.priority
            : enumValue(input.priority, 'priority', ISSUE_PRIORITIES),
      },
      context.userId,
    );
    return { issue: updated };
  }

  async assignIssue(
    issueIdValue: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.body(body);
    const expectedVersion = this.expectedVersion(input);
    const issue = await this.requireVisibleIssue(issueIdValue, context, true);
    this.assertExpectedVersion(issue, expectedVersion);
    const assigneeUserId = optionalUuid(input.assigneeUserId, 'assigneeUserId');
    if (assigneeUserId) {
      await this.projects.getAccess(
        issue.projectId,
        assigneeUserId,
        context.correlationId,
      );
    }

    return {
      issue: await this.issues.assignIssue(
        issue,
        expectedVersion,
        assigneeUserId,
        context.userId,
      ),
    };
  }

  async transitionIssue(
    issueIdValue: string,
    body: unknown,
    context: RequestContext,
  ) {
    const input = this.body(body);
    const status = enumValue(input.status, 'status', ISSUE_STATUSES);
    const issue = await this.requireVisibleIssue(issueIdValue, context, true);
    const expectedVersion = this.expectedVersion(input);
    this.assertExpectedVersion(issue, expectedVersion);
    const transition = assertTransition(issue.status, status);
    return {
      issue: await this.issues.transitionIssue(
        issue,
        expectedVersion,
        transition,
        context.userId,
      ),
    };
  }

  async addComment(
    issueIdValue: string,
    body: unknown,
    context: RequestContext,
  ) {
    const issue = await this.requireVisibleIssue(issueIdValue, context, true);
    const commentBody = requiredText(this.body(body).body, 'body', 5000);
    return {
      comment: await this.issues.addComment(issue, context.userId, commentBody),
    };
  }

  async listComments(issueIdValue: string, context: RequestContext) {
    const issue = await this.requireVisibleIssue(issueIdValue, context);
    return { items: await this.issues.listComments(issue.id) };
  }

  async listHistory(issueIdValue: string, context: RequestContext) {
    const issue = await this.requireVisibleIssue(issueIdValue, context);
    return { items: await this.issues.listHistory(issue.id) };
  }

  private async requireVisibleIssue(
    issueIdValue: string,
    context: RequestContext,
    writable = false,
  ): Promise<Issue> {
    const issueId = uuid(issueIdValue, 'issueId');
    const issue = await this.issues.findIssue(issueId);
    if (!issue) {
      throw notFound();
    }

    try {
      const access = await this.projects.getAccess(
        issue.projectId,
        context.userId,
        context.correlationId,
      );
      if (writable) {
        this.assertWritable(access);
      }
    } catch (error) {
      if (error instanceof DomainError && error.status === 404) {
        throw notFound();
      }
      throw error;
    }

    return issue;
  }

  private async requireWritableProject(
    projectId: string,
    context: RequestContext,
  ): Promise<ProjectAccessContext> {
    const access = await this.projects.getAccess(
      projectId,
      context.userId,
      context.correlationId,
    );
    this.assertWritable(access);
    return access;
  }

  private assertWritable(access: ProjectAccessContext): void {
    if (access.projectStatus === 'ARCHIVED') {
      throw new DomainError(
        409,
        'PROJECT_ARCHIVED',
        'Archived projects reject issue writes',
      );
    }
  }

  private async assertPlanningLinks(
    projectId: string,
    epicId: string | null,
    sprintId: string | null,
  ): Promise<void> {
    if (epicId) {
      const epic = await this.planning.findEpic(epicId);
      if (!epic || epic.projectId !== projectId) {
        throw validationError('epicId', 'epicId must belong to this project');
      }
    }
    if (sprintId) {
      const sprint = await this.planning.findSprint(sprintId);
      if (!sprint || sprint.projectId !== projectId || sprint.status !== 'ACTIVE') {
        throw validationError('sprintId', 'sprintId must be an active sprint in this project');
      }
    }
  }

  private expectedVersion(input: Record<string, unknown>): number {
    const value = input.expectedVersion;
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      throw validationError(
        'expectedVersion',
        'expectedVersion must be a positive integer',
      );
    }
    return value;
  }

  private assertExpectedVersion(issue: Issue, expectedVersion: number): void {
    if (issue.version !== expectedVersion) {
      throw concurrentIssueModification();
    }
  }

  private assertCorePatchFields(input: Record<string, unknown>): void {
    for (const field of [
      'status',
      'key',
      'number',
      'reporterUserId',
      'projectId',
      'issueKey',
      'issueNumber',
    ]) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        throw validationError(field, `${field} cannot be updated`);
      }
    }
  }

  private hasCorePatchMutation(input: Record<string, unknown>): boolean {
    return ['summary', 'description', 'type', 'priority'].some((field) =>
      Object.prototype.hasOwnProperty.call(input, field),
    );
  }

  private body(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw validationError('body', 'Request body is required');
    }
    return value as Record<string, unknown>;
  }
}
