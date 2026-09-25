import assert from 'node:assert/strict';
import test from 'node:test';
import { IssueServiceAdapter } from './issue-service.adapter';
import { assertContract } from '../../testing/contracts';

const context = { userId: 'user-123', correlationId: 'request-123' };
const PROJECT_ID = '5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42';
const USER_ID = 'c3d2e1f0-a9b8-4c7d-8e6f-5a4b3c2d1e0f';
const issue = {
  id: '7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a', projectId: PROJECT_ID, number: 1, key: 'LRN-1',
  summary: 'Created', description: null, type: 'TASK', priority: 'MEDIUM', status: 'IN_PROGRESS',
  reporterUserId: USER_ID, assigneeUserId: null, epicId: null, sprintId: null, version: 2,
  createdAt: '2026-09-25T08:00:00.000Z', updatedAt: '2026-09-25T08:00:00.000Z',
};
const comment = {
  id: '1e2d3c4b-5a69-4788-9a0b-c1d2e3f4a5b6', issueId: issue.id, authorUserId: USER_ID,
  body: 'A gateway-forwarded comment', createdAt: '2026-09-25T08:00:00.000Z', updatedAt: '2026-09-25T08:00:00.000Z',
};
const history = {
  id: '2f3e4d5c-6b7a-4899-8a0b-1c2d3e4f5a6b', issueId: issue.id, actorUserId: USER_ID,
  action: 'COMMENT_ADDED', fromValue: null, toValue: { commentId: comment.id }, createdAt: '2026-09-25T08:00:00.000Z',
};
const epic = {
  id: '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d', projectId: PROJECT_ID, name: 'Launch', color: 'BLUE',
  startDate: null, targetDate: null, createdAt: '2026-09-25T08:00:00.000Z', updatedAt: '2026-09-25T08:00:00.000Z',
};
const sprint = {
  id: '4b5c6d7e-8f9a-4b1c-8d2e-3f4a5b6c7d8e', projectId: PROJECT_ID, name: 'Sprint 1', goal: null,
  startDate: null, endDate: null, status: 'ACTIVE', createdAt: '2026-09-25T08:00:00.000Z', completedAt: null,
};

function issueServiceResponse(definition: string, body: unknown, status = 200): Response {
  assertContract(`http/issue.schema.json#/$defs/${definition}`, body);
  return new Response(JSON.stringify(body), { status });
}

function issueServiceError(status: number, code: string, message: string, details: Record<string, unknown>): Response {
  const envelope = { code, message, correlationId: context.correlationId, details };
  assertContract('http/error.schema.json', envelope);
  return new Response(JSON.stringify(envelope), { status });
}

test('forwards an opaque transition body to the exact Issue Service route without the browser bearer token', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const transition = {
    status: 'IN_PROGRESS',
    expectedVersion: 5,
    passthrough: { keep: 'this object unchanged' },
  };
  globalThis.fetch = (async (input, init) => {
    requests.push({ input: String(input), init });
    return issueServiceResponse('issueResponse', { issue });
  }) as typeof fetch;

  try {
    assert.deepEqual(await new IssueServiceAdapter().transitionIssue('issue / 1', transition, context), { issue });

    assert.equal(requests.length, 1);
    const request = requests[0];
    assert.equal(request.input, 'http://issue-service.test/internal/issues/issue%20%2F%201/transitions');
    assert.equal(request.init?.method, 'POST');
    assert.equal(request.init?.body, JSON.stringify(transition));

    const headers = new Headers(request.init?.headers);
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(headers.get('x-authenticated-user-id'), context.userId);
    assert.equal(headers.get('x-correlation-id'), context.correlationId);
    assert.equal(headers.get('x-internal-service-secret'), 'test-internal-secret');
    assert.equal(headers.get('authorization'), null);
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('forwards Issue Core expectedVersion bodies with identity, correlation, and internal credentials', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ input: String(input), init });
    return String(input).endsWith('/issues') && init?.method === 'GET'
      ? issueServiceResponse('issueList', { items: [issue], nextCursor: null })
      : issueServiceResponse('issueResponse', { issue }, init?.method === 'POST' ? 201 : 200);
  }) as typeof fetch;

  try {
    const adapter = new IssueServiceAdapter();
    assert.deepEqual(await adapter.createIssue('project 1', { summary: 'Created' }, context), { issue });
    assert.deepEqual(await adapter.listIssues('project 1', '', context), { items: [issue], nextCursor: null });
    assert.deepEqual(await adapter.getIssue('issue 1', context), { issue });
    assert.deepEqual(await adapter.updateIssue('issue 1', { summary: 'Changed', expectedVersion: 3 }, context), { issue });
    assert.deepEqual(await adapter.assignIssue('issue 1', { assigneeUserId: null, expectedVersion: 4 }, context), { issue });
    assert.deepEqual(await adapter.transitionIssue('issue 1', { status: 'IN_PROGRESS', expectedVersion: 5 }, context), { issue });

    assert.deepEqual(
      requests.map(({ input, init }) => ({ input, method: init?.method, body: init?.body })),
      [
        {
          input: 'http://issue-service.test/internal/projects/project%201/issues',
          method: 'POST',
          body: JSON.stringify({ summary: 'Created' }),
        },
        {
          input: 'http://issue-service.test/internal/projects/project%201/issues',
          method: 'GET',
          body: undefined,
        },
        {
          input: 'http://issue-service.test/internal/issues/issue%201',
          method: 'GET',
          body: undefined,
        },
        {
          input: 'http://issue-service.test/internal/issues/issue%201',
          method: 'PATCH',
          body: JSON.stringify({ summary: 'Changed', expectedVersion: 3 }),
        },
        {
          input: 'http://issue-service.test/internal/issues/issue%201/assignee',
          method: 'PATCH',
          body: JSON.stringify({ assigneeUserId: null, expectedVersion: 4 }),
        },
        {
          input: 'http://issue-service.test/internal/issues/issue%201/transitions',
          method: 'POST',
          body: JSON.stringify({ status: 'IN_PROGRESS', expectedVersion: 5 }),
        },
      ],
    );
    for (const request of requests) {
      const headers = new Headers(request.init?.headers);
      assert.equal(headers.get('x-authenticated-user-id'), context.userId);
      assert.equal(headers.get('x-correlation-id'), context.correlationId);
      assert.equal(headers.get('x-internal-service-secret'), 'test-internal-secret');
    }
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('forwards the issue list query string unchanged and returns the page body as is', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const page = { items: [issue], nextCursor: 'MjAyNi0wOS0yNVQwODowMDowMC4wMDAwMDBafDdkNmM1YjRh' };
  globalThis.fetch = (async (input, init) => {
    requests.push({ input: String(input), init });
    return issueServiceResponse('issueList', page);
  }) as typeof fetch;

  try {
    const adapter = new IssueServiceAdapter();
    const query = `status=todo&assigneeUserId=${USER_ID}&q=Login%20%25_bug&limit=10&cursor=${page.nextCursor}&limit=11&unknown=1`;
    assert.deepEqual(await adapter.listIssues(PROJECT_ID, query, context), page);
    assert.deepEqual(await adapter.listIssues(PROJECT_ID, '', context), page);

    assert.deepEqual(
      requests.map(({ input, init }) => ({ input, method: init?.method, body: init?.body })),
      [
        {
          input: `http://issue-service.test/internal/projects/${PROJECT_ID}/issues?${query}`,
          method: 'GET',
          body: undefined,
        },
        {
          input: `http://issue-service.test/internal/projects/${PROJECT_ID}/issues`,
          method: 'GET',
          body: undefined,
        },
      ],
    );
    for (const request of requests) {
      const headers = new Headers(request.init?.headers);
      assert.equal(headers.get('x-authenticated-user-id'), context.userId);
      assert.equal(headers.get('x-correlation-id'), context.correlationId);
      assert.equal(headers.get('x-internal-service-secret'), 'test-internal-secret');
    }
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('preserves an Issue Service list validation error without retrying', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return issueServiceError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      cursor: 'cursor is not a valid issue list cursor',
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      new IssueServiceAdapter().listIssues(PROJECT_ID, 'cursor=broken', context),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { statusCode?: number }).statusCode, 400);
        assert.equal((error as Error & { code?: string }).code, 'VALIDATION_ERROR');
        assert.deepEqual(
          (error as Error & { details?: Record<string, unknown> }).details,
          { cursor: 'cursor is not a valid issue list cursor' },
        );
        return true;
      },
    );
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('forwards comment and activity routes with the body and internal request context only', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const responses = [
    () => issueServiceResponse('commentResponse', { comment }, 201),
    () => issueServiceResponse('commentList', { items: [comment] }),
    () => issueServiceResponse('historyList', { items: [history] }),
  ];
  globalThis.fetch = (async (input, init) => {
    requests.push({ input: String(input), init });
    return responses[requests.length - 1]();
  }) as typeof fetch;

  try {
    const adapter = new IssueServiceAdapter();
    const body = { body: 'A gateway-forwarded comment' };
    assert.deepEqual(await adapter.addComment('issue / 1', body, context), { comment });
    assert.deepEqual(await adapter.listComments('issue / 1', context), { items: [comment] });
    assert.deepEqual(await adapter.listHistory('issue / 1', context), { items: [history] });

    assert.deepEqual(
      requests.map(({ input, init }) => ({ input, method: init?.method, body: init?.body })),
      [
        {
          input: 'http://issue-service.test/internal/issues/issue%20%2F%201/comments',
          method: 'POST',
          body: JSON.stringify(body),
        },
        {
          input: 'http://issue-service.test/internal/issues/issue%20%2F%201/comments',
          method: 'GET',
          body: undefined,
        },
        {
          input: 'http://issue-service.test/internal/issues/issue%20%2F%201/history',
          method: 'GET',
          body: undefined,
        },
      ],
    );
    for (const request of requests) {
      const headers = new Headers(request.init?.headers);
      assert.equal(headers.get('x-authenticated-user-id'), context.userId);
      assert.equal(headers.get('x-correlation-id'), context.correlationId);
      assert.equal(headers.get('x-internal-service-secret'), 'test-internal-secret');
      assert.equal(headers.get('authorization'), null);
    }
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('preserves downstream comment errors without a retry', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return issueServiceError(409, 'CONCURRENT_ISSUE_MODIFICATION', 'Issue changed since it was last loaded', { source: 'issue-service' });
  }) as typeof fetch;

  try {
    await assert.rejects(
      new IssueServiceAdapter().addComment('issue-123', { body: 'No retry' }, context),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { statusCode?: number }).statusCode, 409);
        assert.equal((error as Error & { code?: string }).code, 'CONCURRENT_ISSUE_MODIFICATION');
        assert.deepEqual(
          (error as Error & { details?: Record<string, unknown> }).details,
          { source: 'issue-service' },
        );
        return true;
      },
    );
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('preserves a downstream 409 and documents Issue Service unavailability as 503', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      issueServiceError(409, 'CONCURRENT_ISSUE_MODIFICATION', 'Issue changed since it was last loaded', {})) as typeof fetch;
    await assert.rejects(
      new IssueServiceAdapter().updateIssue('issue-123', { expectedVersion: 1 }, context),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { statusCode?: number }).statusCode, 409);
        assert.equal((error as Error & { code?: string }).code, 'CONCURRENT_ISSUE_MODIFICATION');
        return true;
      },
    );

    globalThis.fetch = (async () => {
      throw new Error('connection refused');
    }) as typeof fetch;
    await assert.rejects(
      new IssueServiceAdapter().getIssue('issue-123', context),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { statusCode?: number }).statusCode, 503);
        assert.equal((error as Error & { code?: string }).code, 'ISSUE_SERVICE_UNAVAILABLE');
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('preserves each documented transition conflict code without retrying', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  try {
    for (const code of [
      'INVALID_ISSUE_TRANSITION',
      'CONCURRENT_ISSUE_MODIFICATION',
      'PROJECT_ARCHIVED',
    ]) {
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        return issueServiceError(409, code, `${code} from Issue Service`, { source: 'issue-service' });
      }) as typeof fetch;

      await assert.rejects(
        new IssueServiceAdapter().transitionIssue(
          'issue-123',
          { status: 'IN_PROGRESS', expectedVersion: 1 },
          context,
        ),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal((error as Error & { statusCode?: number }).statusCode, 409);
          assert.equal((error as Error & { code?: string }).code, code);
          assert.deepEqual(
            (error as Error & { details?: Record<string, unknown> }).details,
            { source: 'issue-service' },
          );
          return true;
        },
      );
      assert.equal(fetchCalls, 1);
    }
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('maps a transition transport failure to one stable 503 without retrying', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('connection refused');
  }) as typeof fetch;

  try {
    await assert.rejects(
      new IssueServiceAdapter().transitionIssue(
        'issue-123',
        { status: 'IN_PROGRESS', expectedVersion: 1 },
        context,
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { statusCode?: number }).statusCode, 503);
        assert.equal((error as Error & { code?: string }).code, 'ISSUE_SERVICE_UNAVAILABLE');
        return true;
      },
    );
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

test('forwards planning routes and returns contract-valid Issue Service bodies unchanged', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  const completed = { ...sprint, status: 'COMPLETED', completedAt: '2026-09-26T08:00:00.000Z' };
  const responses = [
    () => issueServiceResponse('epicList', { items: [epic] }),
    () => issueServiceResponse('epicResponse', { epic }, 201),
    () => issueServiceResponse('epicResponse', { epic }),
    () => issueServiceResponse('sprintList', { items: [sprint] }),
    () => issueServiceResponse('sprintResponse', { sprint }, 201),
    () => issueServiceResponse('sprintResponse', { sprint: completed }),
  ];
  globalThis.fetch = (async (input, init) => {
    requests.push(`${init?.method} ${String(input)}`);
    return responses[requests.length - 1]();
  }) as typeof fetch;

  try {
    const adapter = new IssueServiceAdapter();
    assert.deepEqual(await adapter.listEpics('project 1', context), { items: [epic] });
    assert.deepEqual(await adapter.createEpic('project 1', { name: 'Launch' }, context), { epic });
    assert.deepEqual(await adapter.updateEpic('epic 1', { color: 'BLUE' }, context), { epic });
    assert.deepEqual(await adapter.listSprints('project 1', context), { items: [sprint] });
    assert.deepEqual(await adapter.createSprint('project 1', { name: 'Sprint 1' }, context), { sprint });
    assert.deepEqual(await adapter.completeSprint('sprint 1', context), { sprint: completed });
    assert.deepEqual(requests, [
      'GET http://issue-service.test/internal/projects/project%201/epics',
      'POST http://issue-service.test/internal/projects/project%201/epics',
      'PATCH http://issue-service.test/internal/epics/epic%201',
      'GET http://issue-service.test/internal/projects/project%201/sprints',
      'POST http://issue-service.test/internal/projects/project%201/sprints',
      'POST http://issue-service.test/internal/sprints/sprint%201/complete',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});

function configureEnvironment(): () => void {
  const originalUrl = process.env.ISSUE_SERVICE_URL;
  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.ISSUE_SERVICE_URL = 'http://issue-service.test';
  process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret';
  return () => {
    restoreEnvironmentVariable('ISSUE_SERVICE_URL', originalUrl);
    restoreEnvironmentVariable('INTERNAL_SERVICE_SECRET', originalSecret);
  };
}

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
