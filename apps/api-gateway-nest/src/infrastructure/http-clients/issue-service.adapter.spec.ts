import assert from 'node:assert/strict';
import test from 'node:test';
import { IssueServiceAdapter } from './issue-service.adapter';

const context = { userId: 'user-123', correlationId: 'request-123' };

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
    return new Response(JSON.stringify({ issue: { id: 'issue-123' } }), { status: 200 });
  }) as typeof fetch;

  try {
    await new IssueServiceAdapter().transitionIssue('issue / 1', transition, context);

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
    return new Response(JSON.stringify({ issue: { id: 'issue-123' } }), { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = new IssueServiceAdapter();
    await adapter.createIssue('project 1', { summary: 'Created' }, context);
    await adapter.listIssues('project 1', context);
    await adapter.getIssue('issue 1', context);
    await adapter.updateIssue('issue 1', { summary: 'Changed', expectedVersion: 3 }, context);
    await adapter.assignIssue('issue 1', { assigneeUserId: null, expectedVersion: 4 }, context);
    await adapter.transitionIssue('issue 1', { status: 'IN_PROGRESS', expectedVersion: 5 }, context);

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

test('forwards comment and activity routes with the body and internal request context only', async () => {
  const restore = configureEnvironment();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = new IssueServiceAdapter();
    const comment = { body: 'A gateway-forwarded comment' };
    await adapter.addComment('issue / 1', comment, context);
    await adapter.listComments('issue / 1', context);
    await adapter.listHistory('issue / 1', context);

    assert.deepEqual(
      requests.map(({ input, init }) => ({ input, method: init?.method, body: init?.body })),
      [
        {
          input: 'http://issue-service.test/internal/issues/issue%20%2F%201/comments',
          method: 'POST',
          body: JSON.stringify(comment),
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
    return new Response(
      JSON.stringify({
        code: 'CONCURRENT_ISSUE_MODIFICATION',
        message: 'Issue changed since it was last loaded',
        details: { source: 'issue-service' },
      }),
      { status: 409 },
    );
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
      new Response(
        JSON.stringify({
          code: 'CONCURRENT_ISSUE_MODIFICATION',
          message: 'Issue changed since it was last loaded',
          details: {},
        }),
        { status: 409 },
      )) as typeof fetch;
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
        return new Response(
          JSON.stringify({
            code,
            message: `${code} from Issue Service`,
            details: { source: 'issue-service' },
          }),
          { status: 409 },
        );
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
