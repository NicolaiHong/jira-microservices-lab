import { Inject, Injectable } from '@nestjs/common';
import { DomainError, validationError } from '../domain/errors';
import { enumValue, optionalText, uuid } from '../domain/issue';
import { EPIC_COLORS, epicName, optionalDate, planDates } from '../domain/planning';
import {
  PLANNING_REPOSITORY,
  PROJECT_ACCESS_PORT,
  type PlanningRepository,
  type ProjectAccessPort,
} from './ports';
import type { RequestContext } from './issue-application.service';

@Injectable()
export class PlanningApplicationService {
  constructor(
    @Inject(PLANNING_REPOSITORY) private readonly planning: PlanningRepository,
    @Inject(PROJECT_ACCESS_PORT) private readonly projects: ProjectAccessPort,
  ) {}

  async listEpics(projectIdValue: string, context: RequestContext) {
    const projectId = uuid(projectIdValue, 'projectId');
    await this.projects.getAccess(projectId, context.userId, context.correlationId);
    return { items: await this.planning.listEpics(projectId) };
  }

  async createEpic(projectIdValue: string, body: unknown, context: RequestContext) {
    const projectId = uuid(projectIdValue, 'projectId');
    await this.requireWritableProject(projectId, context);
    const input = this.body(body);
    const startDate = optionalDate(input.startDate, 'startDate');
    const targetDate = optionalDate(input.targetDate, 'targetDate');
    planDates(startDate, targetDate);
    return { epic: await this.planning.createEpic({
      projectId,
      name: epicName(input.name),
      color: enumValue(input.color ?? 'BLUE', 'color', EPIC_COLORS),
      startDate,
      targetDate,
    }) };
  }

  async updateEpic(epicIdValue: string, body: unknown, context: RequestContext) {
    const epic = await this.requireVisibleEpic(epicIdValue, context, true);
    const input = this.body(body);
    const startDate = input.startDate === undefined ? epic.startDate : optionalDate(input.startDate, 'startDate');
    const targetDate = input.targetDate === undefined ? epic.targetDate : optionalDate(input.targetDate, 'targetDate');
    planDates(startDate, targetDate);
    return { epic: await this.planning.updateEpic(epic, {
      name: input.name === undefined ? epic.name : epicName(input.name),
      color: input.color === undefined ? epic.color : enumValue(input.color, 'color', EPIC_COLORS),
      startDate,
      targetDate,
    }) };
  }

  async listSprints(projectIdValue: string, context: RequestContext) {
    const projectId = uuid(projectIdValue, 'projectId');
    await this.projects.getAccess(projectId, context.userId, context.correlationId);
    return { items: await this.planning.listSprints(projectId) };
  }

  async createSprint(projectIdValue: string, body: unknown, context: RequestContext) {
    const projectId = uuid(projectIdValue, 'projectId');
    await this.requireWritableProject(projectId, context);
    const input = this.body(body);
    const startDate = optionalDate(input.startDate, 'startDate');
    const endDate = optionalDate(input.endDate, 'endDate');
    planDates(startDate, endDate);
    return { sprint: await this.planning.createSprint({
      projectId,
      name: epicName(input.name),
      goal: optionalText(input.goal, 'goal', 500),
      startDate,
      endDate,
    }) };
  }

  async completeSprint(sprintIdValue: string, context: RequestContext) {
    const sprintId = uuid(sprintIdValue, 'sprintId');
    const sprint = await this.planning.findSprint(sprintId);
    if (!sprint) throw new DomainError(404, 'SPRINT_NOT_FOUND', 'Sprint was not found');
    await this.requireWritableProject(sprint.projectId, context);
    if (sprint.status !== 'ACTIVE') {
      throw new DomainError(409, 'SPRINT_ALREADY_COMPLETED', 'Sprint has already been completed');
    }
    return { sprint: await this.planning.completeSprint(sprint) };
  }

  private async requireVisibleEpic(epicIdValue: string, context: RequestContext, writable = false) {
    const epicId = uuid(epicIdValue, 'epicId');
    const epic = await this.planning.findEpic(epicId);
    if (!epic) throw new DomainError(404, 'EPIC_NOT_FOUND', 'Epic was not found');
    if (writable) await this.requireWritableProject(epic.projectId, context);
    else await this.projects.getAccess(epic.projectId, context.userId, context.correlationId);
    return epic;
  }

  private async requireWritableProject(projectId: string, context: RequestContext) {
    const access = await this.projects.getAccess(projectId, context.userId, context.correlationId);
    if (access.projectStatus === 'ARCHIVED') {
      throw new DomainError(409, 'PROJECT_ARCHIVED', 'Archived projects reject planning writes');
    }
  }

  private body(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw validationError('body', 'Request body is required');
    }
    return value as Record<string, unknown>;
  }
}
