import { randomUUID } from 'node:crypto';
import { DomainError, validationError } from './errors';

export const ISSUE_TYPES = ['TASK', 'BUG', 'STORY'] as const;
export const ISSUE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const ISSUE_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface Issue {
  id: string;
  projectId: string;
  number: number;
  key: string;
  summary: string;
  description: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  reporterUserId: string;
  assigneeUserId: string | null;
  epicId: string | null;
  sprintId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueComment {
  id: string;
  issueId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueHistory {
  id: string;
  issueId: string;
  actorUserId: string;
  action: string;
  fromValue: unknown;
  toValue: unknown;
  createdAt: Date;
}

const transitions: Record<IssueStatus, readonly IssueStatus[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['TODO', 'DONE'],
  DONE: ['IN_PROGRESS'],
};

export function requiredText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(field, `${field} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw validationError(
      field,
      `${field} must be ${maxLength} characters or fewer`,
    );
  }

  return normalized;
}

export function optionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  return requiredText(value, field, maxLength);
}

export function enumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string') {
    throw validationError(field, `${field} is required`);
  }

  const normalized = value.trim().toUpperCase() as T;
  if (!allowed.includes(normalized)) {
    throw validationError(field, `${field} must be one of ${allowed.join(', ')}`);
  }

  return normalized;
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return uuid(value, field);
}

export function uuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw validationError(field, `${field} must be a valid UUID`);
  }

  return value.toLowerCase();
}

export function assertTransition(from: IssueStatus, to: IssueStatus): void {
  if (from === to || !transitions[from].includes(to)) {
    throw new DomainError(
      409,
      'INVALID_ISSUE_TRANSITION',
      `Issue cannot transition from ${from} to ${to}`,
      { from, to, allowed: transitions[from] },
    );
  }
}

export function history(
  issueId: string,
  actorUserId: string,
  action: string,
  fromValue: unknown,
  toValue: unknown,
): IssueHistory {
  return {
    id: randomUUID(),
    issueId,
    actorUserId,
    action,
    fromValue,
    toValue,
    createdAt: new Date(),
  };
}
