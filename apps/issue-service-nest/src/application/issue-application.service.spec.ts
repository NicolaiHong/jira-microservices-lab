import assert from 'node:assert/strict';
import test from 'node:test';
import { IssueApplicationService } from './issue-application.service';
import type {
  IssueRepository,
  NewIssueData,
  PlanningRepository,
  ProjectAccessPort,
  UpdateIssueData,
} from './ports';
import type {
  Issue,
  IssueComment,
  IssueHistory,
  ValidatedIssueTransition,
} from '../domain/issue';
import { DomainError } from '../domain/errors';

const ids = {
  project: '11111111-1111-4111-8111-111111111111',
  issue: '22222222-2222-4222-8222-222222222222',
  reporter: '33333333-3333-4333-8333-333333333333',
  member: '44444444-4444-4444-8444-444444444444',
  outsider: '55555555-5555-4555-8555-555555555555',
  admin: '66666666-6666-4666-8666-666666666666',
};

const context = { userId: ids.reporter, correlationId: 'issue-core-test' };

function issue(version = 1): Issue {
  return {
    id: ids.issue,
    projectId: ids.project,
    number: 1,
    key: 'CORE-1',
    summary: 'Original summary',
    description: 'Original description',
    type: 'TASK',
    priority: 'MEDIUM',
    status: 'TODO',
    reporterUserId: ids.reporter,
    assigneeUserId: null,
    epicId: null,
    sprintId: null,
    version,
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
    updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  };
}

interface FakeRepository extends IssueRepository {
  current: Issue;
  updateCalls: Array<{ expectedVersion: number; data: UpdateIssueData }>;
  assignmentCalls: Array<{ expectedVersion: number; assigneeUserId: string | null }>;
  transitionCalls: Array<{
    expectedVersion: number;
    transition: ValidatedIssueTransition;
  }>;
  creates: NewIssueData[];
}

function fakeRepository(current = issue()): FakeRepository {
  const repository = {
    current,
    updateCalls: [] as Array<{ expectedVersion: number; data: UpdateIssueData }>,
    assignmentCalls: [] as Array<{ expectedVersion: number; assigneeUserId: string | null }>,
    transitionCalls: [] as Array<{
      expectedVersion: number;
      transition: ValidatedIssueTransition;
    }>,
    creates: [] as NewIssueData[],
    async createIssue(data: NewIssueData) {
      repository.creates.push(data);
      return {
        ...repository.current,
        summary: data.summary,
        description: data.description,
        type: data.type as Issue['type'],
        priority: data.priority as Issue['priority'],
        reporterUserId: data.reporterUserId,
        assigneeUserId: data.assigneeUserId,
      };
    },
    async listIssues() {
      return [repository.current];
    },
    async findIssue() {
      return repository.current;
    },
    async updateIssue(
      currentIssue: Issue,
      expectedVersion: number,
      data: UpdateIssueData,
    ) {
      repository.updateCalls.push({ expectedVersion, data });
      repository.current = {
        ...currentIssue,
        ...data,
        type: data.type as Issue['type'],
        priority: data.priority as Issue['priority'],
        version: expectedVersion + 1,
      };
      return repository.current;
    },
    async assignIssue(
      currentIssue: Issue,
      expectedVersion: number,
      assigneeUserId: string | null,
    ) {
      repository.assignmentCalls.push({ expectedVersion, assigneeUserId });
      repository.current = { ...currentIssue, assigneeUserId, version: expectedVersion + 1 };
      return repository.current;
    },
    async transitionIssue(
      currentIssue: Issue,
      expectedVersion: number,
      transition: ValidatedIssueTransition,
    ) {
      repository.transitionCalls.push({ expectedVersion, transition });
      repository.current = {
        ...currentIssue,
        status: transition.to,
        version: expectedVersion + 1,
      };
      return repository.current;
    },
    async addComment(): Promise<IssueComment> {
      throw new Error('not used by this test');
    },
    async listComments(): Promise<IssueComment[]> {
      return [];
    },
    async listHistory(): Promise<IssueHistory[]> {
      return [];
    },
    async pendingEvents() {
      return [];
    },
    async markEventPublished() {},
    async recordPublishFailure() {},
  };
  return repository as FakeRepository;
}

function projectAccess(status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  const calls: string[] = [];
  const port: ProjectAccessPort = {
    async getAccess(projectId, userId) {
      calls.push(userId);
      assert.equal(projectId, ids.project);
      if (userId === ids.outsider) {
        throw new DomainError(404, 'PROJECT_NOT_FOUND', 'Project was not found');
      }
      return {
        projectId,
        workspaceId: '77777777-7777-4777-8777-777777777777',
        projectKey: 'CORE',
        projectStatus: status,
        membershipRole:
          userId === ids.member
            ? 'MEMBER'
            : userId === ids.admin
              ? 'ADMIN'
              : 'OWNER',
      };
    },
  };
  return { port, calls };
}

function planning(): PlanningRepository {
  return {
    async createEpic() {
      throw new Error('not used');
    },
    async listEpics() {
      return [];
    },
    async findEpic() {
      return null;
    },
    async updateEpic() {
      throw new Error('not used');
    },
    async createSprint() {
      throw new Error('not used');
    },
    async listSprints() {
      return [];
    },
    async findSprint() {
      return null;
    },
    async completeSprint() {
      throw new Error('not used');
    },
  };
}

function service(repository = fakeRepository(), status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  const access = projectAccess(status);
  return {
    repository,
    access,
    application: new IssueApplicationService(repository, planning(), access.port),
  };
}

test('requires a positive safe integer expectedVersion for real Issue Core mutations', async () => {
  for (const body of [
    { status: 'IN_PROGRESS' },
    { status: 'IN_PROGRESS', expectedVersion: 0 },
    { status: 'IN_PROGRESS', expectedVersion: -1 },
    { status: 'IN_PROGRESS', expectedVersion: 1.5 },
    { status: 'IN_PROGRESS', expectedVersion: '1' },
  ]) {
    const { application, repository } = service();
    await assert.rejects(
      application.transitionIssue(ids.issue, body, context),
      (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.deepEqual(error.details, {
        expectedVersion: 'expectedVersion must be a positive integer',
      });
        return true;
      },
    );
    assert.equal(repository.transitionCalls.length, 0);
  }
});

test('uses the rendered expectedVersion for successful details, assignment, and transition writes', async () => {
  const { application, repository } = service();
  const updated = await application.updateIssue(
    ids.issue,
    { expectedVersion: 1, summary: '  Updated summary  ' },
    context,
  );
  assert.equal(updated.issue.version, 2);
  assert.deepEqual(repository.updateCalls[0], {
    expectedVersion: 1,
    data: {
      summary: 'Updated summary',
      description: 'Original description',
      type: 'TASK',
      priority: 'MEDIUM',
    },
  });

  const assigned = await application.assignIssue(
    ids.issue,
    { expectedVersion: 2, assigneeUserId: ids.member },
    context,
  );
  assert.equal(assigned.issue.version, 3);
  assert.deepEqual(repository.assignmentCalls[0], {
    expectedVersion: 2,
    assigneeUserId: ids.member,
  });

  const reassigned = await application.assignIssue(
    ids.issue,
    { expectedVersion: 3, assigneeUserId: ids.admin },
    context,
  );
  assert.equal(reassigned.issue.version, 4);
  assert.deepEqual(repository.assignmentCalls[1], {
    expectedVersion: 3,
    assigneeUserId: ids.admin,
  });

  const unassigned = await application.assignIssue(
    ids.issue,
    { expectedVersion: 4, assigneeUserId: null },
    context,
  );
  assert.equal(unassigned.issue.version, 5);
  assert.deepEqual(repository.assignmentCalls[2], {
    expectedVersion: 4,
    assigneeUserId: null,
  });

  const transitioned = await application.transitionIssue(
    ids.issue,
    { expectedVersion: 5, status: 'in_progress' },
    context,
  );
  assert.equal(transitioned.issue.version, 6);
  assert.equal(repository.transitionCalls[0].expectedVersion, 5);
  assert.equal(repository.transitionCalls[0].transition.from, 'TODO');
  assert.equal(repository.transitionCalls[0].transition.to, 'IN_PROGRESS');
});

test('rejects stale expectedVersions before details, assignment, or transition persistence', async () => {
  const repository = fakeRepository(issue(2));
  const { application } = service(repository);
  for (const invoke of [
    () => application.updateIssue(ids.issue, { expectedVersion: 1, summary: 'Stale' }, context),
    () => application.assignIssue(ids.issue, { expectedVersion: 1, assigneeUserId: null }, context),
    () => application.transitionIssue(ids.issue, { expectedVersion: 1, status: 'IN_PROGRESS' }, context),
  ]) {
    await assert.rejects(
      invoke,
      (error: unknown) =>
        error instanceof DomainError &&
        error.status === 409 &&
        error.code === 'CONCURRENT_ISSUE_MODIFICATION',
    );
  }
  assert.equal(repository.updateCalls.length, 0);
  assert.equal(repository.assignmentCalls.length, 0);
  assert.equal(repository.transitionCalls.length, 0);
});

test('preserves transition input, project, version, and graph error precedence', async () => {
  for (const body of [{ expectedVersion: 1 }, { status: 'not-a-status', expectedVersion: 1 }]) {
    const { application, access } = service(fakeRepository(), 'ARCHIVED');
    await assert.rejects(
      application.transitionIssue(ids.issue, body, context),
      (error: unknown) =>
        error instanceof DomainError &&
        error.status === 400 &&
        error.code === 'VALIDATION_ERROR',
    );
    assert.deepEqual(access.calls, []);
  }

  for (const body of [
    { status: 'IN_PROGRESS' },
    { status: 'IN_PROGRESS', expectedVersion: 0 },
    { status: 'IN_PROGRESS', expectedVersion: 1 },
  ]) {
    const { application, repository } = service(
      fakeRepository(body.expectedVersion === 1 ? issue(2) : issue()),
      'ARCHIVED',
    );
    await assert.rejects(
      application.transitionIssue(ids.issue, body, context),
      (error: unknown) =>
        error instanceof DomainError &&
        error.status === 409 &&
        error.code === 'PROJECT_ARCHIVED',
    );
    assert.equal(repository.transitionCalls.length, 0);
  }

  const stale = service(fakeRepository(issue(2)));
  await assert.rejects(
    stale.application.transitionIssue(
      ids.issue,
      { status: 'DONE', expectedVersion: 1 },
      context,
    ),
    (error: unknown) =>
      error instanceof DomainError &&
      error.status === 409 &&
      error.code === 'CONCURRENT_ISSUE_MODIFICATION',
  );
  assert.equal(stale.repository.transitionCalls.length, 0);

  const illegal = service();
  await assert.rejects(
    illegal.application.transitionIssue(
      ids.issue,
      { status: 'DONE', expectedVersion: 1 },
      context,
    ),
    (error: unknown) =>
      error instanceof DomainError &&
      error.status === 409 &&
      error.code === 'INVALID_ISSUE_TRANSITION',
  );
  assert.equal(illegal.repository.transitionCalls.length, 0);
});

test('preserves omitted descriptions and normalizes clear and trim semantics', async () => {
  const cases: Array<[unknown, string | null]> = [
    [undefined, 'Original description'],
    [null, null],
    ['', null],
    ['   ', null],
    ['  Trimmed description  ', 'Trimmed description'],
  ];
  for (const [description, expected] of cases) {
    const { application, repository } = service();
    const body: Record<string, unknown> = {
      expectedVersion: 1,
      summary: 'Updated summary',
    };
    if (description !== undefined) body.description = description;
    await application.updateIssue(ids.issue, body, context);
    assert.equal(repository.updateCalls[0].data.description, expected);
  }
});

test('rejects overlong descriptions and all public immutable core PATCH fields', async () => {
  const { application } = service();
  await assert.rejects(
    application.updateIssue(
      ids.issue,
      { expectedVersion: 1, description: 'x'.repeat(5001) },
      context,
    ),
    (error: unknown) => error instanceof DomainError && error.code === 'VALIDATION_ERROR',
  );

  for (const field of [
    'status',
    'key',
    'number',
    'reporterUserId',
    'projectId',
    'issueKey',
    'issueNumber',
  ]) {
    await assert.rejects(
      application.updateIssue(ids.issue, { [field]: 'changed' }, context),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.status, 400);
        assert.equal(error.code, 'VALIDATION_ERROR');
        assert.deepEqual(error.details, { [field]: `${field} cannot be updated` });
        return true;
      },
    );
  }
});

test('returns no-mutable PATCHes as visible reads without CAS or side effects', async () => {
  const { application, repository, access } = service();

  for (const body of [{}, { expectedVersion: 1 }, { expectedVersion: 999 }]) {
    const result = await application.updateIssue(ids.issue, body, context);
    assert.equal(result.issue.id, ids.issue);
    assert.equal(result.issue.version, 1);
  }

  assert.equal(repository.updateCalls.length, 0);
  assert.deepEqual(access.calls, [ids.reporter, ids.reporter, ids.reporter]);

  await assert.rejects(
    application.updateIssue(ids.issue, { expectedVersion: 0 }, context),
    (error: unknown) =>
      error instanceof DomainError &&
      error.status === 400 &&
      error.code === 'VALIDATION_ERROR',
  );
  assert.equal(repository.updateCalls.length, 0);
});

test('derives reporter provenance, normalizes creation values, and checks a supplied assignee', async () => {
  const { application, repository, access } = service();
  const result = await application.createIssue(
    ids.project,
    {
      summary: '  Create an issue  ',
      description: '  Context  ',
      type: 'bug',
      priority: 'high',
      assigneeUserId: ids.member,
      reporterUserId: ids.outsider,
    },
    context,
  );
  assert.equal(result.issue.status, 'TODO');
  assert.deepEqual(repository.creates[0], {
    projectId: ids.project,
    projectKey: 'CORE',
    summary: 'Create an issue',
    description: 'Context',
    type: 'BUG',
    priority: 'HIGH',
    reporterUserId: ids.reporter,
    assigneeUserId: ids.member,
    epicId: null,
    sprintId: null,
  });
  assert.deepEqual(access.calls, [ids.reporter, ids.member]);

  await assert.rejects(
    application.assignIssue(
      ids.issue,
      { expectedVersion: 1, assigneeUserId: ids.outsider },
      context,
    ),
    (error: unknown) => error instanceof DomainError && error.status === 404,
  );
});

test('allows issue creation and reads for OWNER, ADMIN, and MEMBER while hiding issues from non-members', async () => {
  for (const userId of [ids.reporter, ids.admin, ids.member]) {
    const { application, repository } = service();
    const actor = { ...context, userId };
    await assert.doesNotReject(
      application.createIssue(
        ids.project,
        { summary: 'Boundary', description: 'x'.repeat(5000), type: 'TASK', priority: 'LOW' },
        actor,
      ),
    );
    assert.equal(repository.creates[0].reporterUserId, userId);
    assert.equal(repository.creates[0].summary.length, 8);
    assert.equal(repository.creates[0].description?.length, 5000);
    await assert.doesNotReject(application.listIssues(ids.project, actor));
    await assert.doesNotReject(application.getIssue(ids.issue, actor));
  }

  const { application } = service();
  const outsider = { ...context, userId: ids.outsider };
  await assert.rejects(
    application.createIssue(
      ids.project,
      { summary: 'Forbidden', type: 'TASK', priority: 'LOW' },
      outsider,
    ),
    (error: unknown) => error instanceof DomainError && error.status === 404,
  );
  await assert.rejects(
    application.getIssue(ids.issue, outsider),
    (error: unknown) => error instanceof DomainError && error.code === 'ISSUE_NOT_FOUND',
  );
});

test('allows MEMBER, ADMIN, and OWNER transitions while concealing issues from non-members', async () => {
  for (const userId of [ids.member, ids.admin, ids.reporter]) {
    const { application, repository } = service();
    const result = await application.transitionIssue(
      ids.issue,
      { status: 'IN_PROGRESS', expectedVersion: 1 },
      { ...context, userId },
    );
    assert.equal(result.issue.status, 'IN_PROGRESS');
    assert.equal(repository.transitionCalls.length, 1);
  }

  const { application, repository } = service();
  await assert.rejects(
    application.transitionIssue(
      ids.issue,
      { status: 'IN_PROGRESS', expectedVersion: 1 },
      { ...context, userId: ids.outsider },
    ),
    (error: unknown) =>
      error instanceof DomainError &&
      error.status === 404 &&
      error.code === 'ISSUE_NOT_FOUND',
  );
  assert.equal(repository.transitionCalls.length, 0);
});

test('does not remove an assignee from existing issue data after that user loses access', async () => {
  const repository = fakeRepository({ ...issue(), assigneeUserId: ids.outsider });
  const { application } = service(repository);
  const read = await application.getIssue(ids.issue, context);
  assert.equal(read.issue.assigneeUserId, ids.outsider);
});

test('keeps archived issues readable while blocking real Issue Core writes', async () => {
  const { application, repository } = service(fakeRepository(), 'ARCHIVED');
  await assert.doesNotReject(application.listIssues(ids.project, context));
  await assert.doesNotReject(application.getIssue(ids.issue, context));

  for (const invoke of [
    () => application.createIssue(ids.project, { summary: 'New', type: 'TASK', priority: 'LOW' }, context),
    () => application.updateIssue(ids.issue, { expectedVersion: 1, summary: 'Blocked' }, context),
    () => application.assignIssue(ids.issue, { expectedVersion: 1, assigneeUserId: null }, context),
    () => application.transitionIssue(ids.issue, { expectedVersion: 1, status: 'IN_PROGRESS' }, context),
  ]) {
    await assert.rejects(
      invoke,
      (error: unknown) =>
        error instanceof DomainError && error.status === 409 && error.code === 'PROJECT_ARCHIVED',
    );
  }
  assert.equal(repository.creates.length, 0);
  assert.equal(repository.updateCalls.length, 0);
  assert.equal(repository.assignmentCalls.length, 0);
  assert.equal(repository.transitionCalls.length, 0);
});

test('allows archived-project no-mutable PATCH reads without a write', async () => {
  const { application, repository } = service(fakeRepository(), 'ARCHIVED');
  const result = await application.updateIssue(ids.issue, {}, context);

  assert.equal(result.issue.id, ids.issue);
  assert.equal(result.issue.version, 1);
  assert.equal(repository.updateCalls.length, 0);
});
