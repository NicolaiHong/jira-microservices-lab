import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '../domain/errors';
import { IssueApplicationService } from './issue-application.service';
import {
  decodeIssueCursor,
  encodeIssueCursor,
  parseIssueListQuery,
} from './issue-list-query';
import type {
  IssueListFilter,
  IssueListPosition,
  IssueRepository,
  PlanningRepository,
  ProjectAccessPort,
} from './ports';

const projectId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const sprintId = '33333333-3333-4333-8333-333333333333';
const position: IssueListPosition = {
  createdAt: '2026-09-25T08:00:00.123456Z',
  id: '44444444-4444-4444-8444-444444444444',
};
const context = { userId, correlationId: 'issue-list-query-test' };

function assertValidationError(invoke: () => unknown, field: string): void {
  assert.throws(invoke, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, 400);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(Object.keys(error.details), [field]);
    return true;
  });
}

test('defaults to the first page of 25 unfiltered issues', () => {
  assert.deepEqual(parseIssueListQuery({}), {
    filter: { status: undefined, assigneeUserId: undefined, sprintId: undefined, q: undefined },
    limit: 25,
    after: null,
  });
  assert.equal(parseIssueListQuery(undefined).limit, 25);
});

test('normalizes every supported filter, the limit, and the cursor', () => {
  assert.deepEqual(
    parseIssueListQuery({
      status: ' in_progress ',
      assigneeUserId: userId.toUpperCase(),
      sprintId,
      q: '  Login bug ',
      limit: '50',
      cursor: encodeIssueCursor(position),
    }),
    {
      filter: { status: 'IN_PROGRESS', assigneeUserId: userId, sprintId, q: 'Login bug' },
      limit: 50,
      after: position,
    },
  );
  assert.equal(parseIssueListQuery({ limit: '1' }).limit, 1);
  assert.equal(parseIssueListQuery({ q: 'x'.repeat(200) }).filter.q?.length, 200);
});

test('rejects invalid, unknown, and repeated parameters with a VALIDATION_ERROR naming the parameter', () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ status: 'CLOSED' }, 'status'],
    [{ status: '' }, 'status'],
    [{ assigneeUserId: 'not-a-uuid' }, 'assigneeUserId'],
    [{ sprintId: '' }, 'sprintId'],
    [{ q: '' }, 'q'],
    [{ q: '   ' }, 'q'],
    [{ q: 'x'.repeat(201) }, 'q'],
    [{ limit: '0' }, 'limit'],
    [{ limit: '51' }, 'limit'],
    [{ limit: '-1' }, 'limit'],
    [{ limit: '2.5' }, 'limit'],
    [{ limit: '1e1' }, 'limit'],
    [{ limit: 'ten' }, 'limit'],
    [{ limit: '' }, 'limit'],
    [{ sort: 'created_at' }, 'sort'],
    [{ status: ['TODO', 'DONE'] }, 'status'],
    [{ cursor: '' }, 'cursor'],
  ];
  for (const [query, field] of cases) {
    assertValidationError(() => parseIssueListQuery(query), field);
  }
});

test('round-trips a cursor without losing microseconds', () => {
  const cursor = encodeIssueCursor(position);
  assert.match(cursor, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeIssueCursor(cursor), position);
});

test('rejects a malformed or non-canonical cursor', () => {
  const encode = (text: string) => Buffer.from(text).toString('base64url');
  const valid = encodeIssueCursor(position);
  for (const cursor of [
    'not a cursor!',
    `${valid}=`,
    `${valid}!`,
    encode(position.id),
    encode(`${position.createdAt}|${position.id}|extra`),
    encode(`2026-09-25T08:00:00.123Z|${position.id}`),
    encode(`2026-02-30T08:00:00.000000Z|${position.id}`),
    encode(`2026-13-01T08:00:00.000000Z|${position.id}`),
    encode(`${position.createdAt}|not-a-uuid`),
    encode(`${position.createdAt}|`),
  ]) {
    assertValidationError(() => decodeIssueCursor(cursor), 'cursor');
  }
});

test('validates the query before asking Project Service and encodes the next position', async () => {
  const accessCalls: string[] = [];
  const listCalls: Array<{ filter: IssueListFilter; after: IssueListPosition | null; limit: number }> = [];
  let next: IssueListPosition | null = position;
  const access: ProjectAccessPort = {
    async getAccess(id) {
      accessCalls.push(id);
      return {
        projectId: id,
        workspaceId: '55555555-5555-4555-8555-555555555555',
        projectKey: 'CORE',
        projectStatus: 'ARCHIVED',
        membershipRole: 'MEMBER',
      };
    },
  };
  const repository = {
    async listIssues(_projectId: string, filter: IssueListFilter, after: IssueListPosition | null, limit: number) {
      listCalls.push({ filter, after, limit });
      return { items: [], next };
    },
  } as unknown as IssueRepository;
  const application = new IssueApplicationService(repository, {} as PlanningRepository, access);

  await assert.rejects(
    application.listIssues(projectId, { limit: '100' }, context),
    (error: unknown) => error instanceof DomainError && error.code === 'VALIDATION_ERROR',
  );
  assert.deepEqual(accessCalls, []);

  assert.deepEqual(
    await application.listIssues(projectId, { sprintId, limit: '10' }, context),
    { items: [], nextCursor: encodeIssueCursor(position) },
  );
  next = null;
  assert.deepEqual(
    await application.listIssues(projectId, { cursor: encodeIssueCursor(position) }, context),
    { items: [], nextCursor: null },
  );
  assert.deepEqual(accessCalls, [projectId, projectId]);
  assert.deepEqual(listCalls.map((call) => [call.filter.sprintId, call.after, call.limit]), [
    [sprintId, null, 10],
    [undefined, position, 25],
  ]);
});
