import { validationError } from '../domain/errors';
import { ISSUE_STATUSES, enumValue, requiredText, uuid } from '../domain/issue';
import type { IssueListFilter, IssueListPosition } from './ports';

export const ISSUE_LIST_DEFAULT_LIMIT = 25;
export const ISSUE_LIST_MAX_LIMIT = 50;

const PARAMETERS = new Set(['status', 'assigneeUserId', 'sprintId', 'q', 'limit', 'cursor']);
// PostgreSQL formats the position with microseconds (see the repository).
const CURSOR_CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export interface IssueListQuery {
  filter: IssueListFilter;
  limit: number;
  after: IssueListPosition | null;
}

/** Validates the SEARCH-001 query string (ADR 0005). */
export function parseIssueListQuery(query: unknown): IssueListQuery {
  const params: Record<string, string> = {};
  for (const [name, value] of Object.entries(query ?? {})) {
    if (!PARAMETERS.has(name)) {
      throw validationError(name, `${name} is not a supported parameter`);
    }
    if (typeof value !== 'string') {
      throw validationError(name, `${name} must be given once`);
    }
    params[name] = value;
  }

  const { status, assigneeUserId, sprintId, q, limit, cursor } = params;
  return {
    filter: {
      status: status === undefined ? undefined : enumValue(status, 'status', ISSUE_STATUSES),
      assigneeUserId:
        assigneeUserId === undefined ? undefined : uuid(assigneeUserId, 'assigneeUserId'),
      sprintId: sprintId === undefined ? undefined : uuid(sprintId, 'sprintId'),
      q: q === undefined ? undefined : requiredText(q, 'q', 200),
    },
    limit: limit === undefined ? ISSUE_LIST_DEFAULT_LIMIT : parseLimit(limit),
    after: cursor === undefined ? null : decodeIssueCursor(cursor),
  };
}

export function encodeIssueCursor(position: IssueListPosition): string {
  return Buffer.from(`${position.createdAt}|${position.id}`).toString('base64url');
}

export function decodeIssueCursor(cursor: string): IssueListPosition {
  const text = Buffer.from(cursor, 'base64url').toString('utf8');
  const [createdAt = '', id = '', extra] = text.split('|');
  const time = Date.parse(createdAt);
  if (
    extra !== undefined ||
    Buffer.from(text).toString('base64url') !== cursor ||
    !CURSOR_CREATED_AT.test(createdAt) ||
    Number.isNaN(time) ||
    new Date(time).toISOString().slice(0, 23) !== createdAt.slice(0, 23)
  ) {
    throw invalidCursor();
  }
  try {
    return { createdAt, id: uuid(id, 'cursor') };
  } catch {
    throw invalidCursor();
  }
}

function parseLimit(value: string): number {
  const limit = /^\d{1,3}$/.test(value) ? Number(value) : NaN;
  if (!(limit >= 1 && limit <= ISSUE_LIST_MAX_LIMIT)) {
    throw validationError('limit', `limit must be an integer from 1 to ${ISSUE_LIST_MAX_LIMIT}`);
  }
  return limit;
}

function invalidCursor() {
  return validationError('cursor', 'cursor is not a valid issue list cursor');
}
