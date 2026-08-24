import { DomainError, validationError } from './errors';
import { requiredText } from './issue';

export const EPIC_COLORS = ['PURPLE', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE'] as const;
export const SPRINT_STATUSES = ['ACTIVE', 'COMPLETED'] as const;

export type EpicColor = (typeof EPIC_COLORS)[number];
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export interface Epic {
  id: string;
  projectId: string;
  name: string;
  color: EpicColor;
  startDate: string | null;
  targetDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  createdAt: Date;
  completedAt: Date | null;
}

export function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(field, `${field} must be an ISO date (YYYY-MM-DD)`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw validationError(field, `${field} must be a valid date`);
  }
  return value;
}

export function planDates(startDate: string | null, endDate: string | null): void {
  if (startDate && endDate && startDate > endDate) {
    throw new DomainError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      targetDate: 'targetDate must be on or after startDate',
    });
  }
}

export function epicName(value: unknown): string {
  return requiredText(value, 'name', 120);
}
