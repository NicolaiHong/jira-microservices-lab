import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectServiceAdapter } from './project-service.adapter';

test('forwards authenticated user, correlation ID, and internal credential to Project Service', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.PROJECT_SERVICE_URL;
  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.PROJECT_SERVICE_URL = 'http://project-service.test';
  process.env.INTERNAL_SERVICE_SECRET = 'unchanged-internal-secret';

  globalThis.fetch = (async (input, init) => {
    assert.equal(input, 'http://project-service.test/internal/workspaces');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-authenticated-user-id'), 'user-123');
    assert.equal(headers.get('x-correlation-id'), 'req-workspace-123');
    assert.equal(
      headers.get('x-internal-service-secret'),
      'unchanged-internal-secret',
    );
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(init?.body, JSON.stringify({ name: 'Team', slug: 'team' }));

    return new Response(
      JSON.stringify({ workspace: { id: 'workspace-123' } }),
      { status: 201 },
    );
  }) as typeof fetch;

  try {
    const adapter = new ProjectServiceAdapter();

    const response = await adapter.createWorkspace(
      { name: 'Team', slug: 'team' },
      { userId: 'user-123', correlationId: 'req-workspace-123' },
    );

    assert.deepEqual(response, { workspace: { id: 'workspace-123' } });
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironmentVariable('PROJECT_SERVICE_URL', originalUrl);
    restoreEnvironmentVariable('INTERNAL_SERVICE_SECRET', originalSecret);
  }
});

test('forwards the complete Project lifecycle through the internal contract', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.PROJECT_SERVICE_URL;
  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.PROJECT_SERVICE_URL = 'http://project-service.test';
  process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret';
  const requests: Array<{
    path: string;
    method?: string;
    headers: Headers;
    body?: BodyInit | null;
  }> = [];

  globalThis.fetch = (async (input, init) => {
    requests.push({
      path: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: init?.body,
    });
    return init?.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const adapter = new ProjectServiceAdapter();
    const context = { userId: 'user-456', correlationId: 'req-project-456' };

    await adapter.createProject('workspace 1', { name: 'Learning', key: 'LRN' }, context);
    await adapter.listProjects('workspace 1', context);
    await adapter.getProject('project 1', context);
    await adapter.updateProject('project 1', { description: null }, context);
    await adapter.archiveProject('project 1', context);

    assert.deepEqual(
      requests.map((request) => ({
        path: request.path,
        method: request.method,
        body: request.body,
      })),
      [
        {
          path: 'http://project-service.test/internal/workspaces/workspace%201/projects',
          method: 'POST',
          body: JSON.stringify({ name: 'Learning', key: 'LRN' }),
        },
        {
          path: 'http://project-service.test/internal/workspaces/workspace%201/projects',
          method: 'GET',
          body: undefined,
        },
        {
          path: 'http://project-service.test/internal/projects/project%201',
          method: 'GET',
          body: undefined,
        },
        {
          path: 'http://project-service.test/internal/projects/project%201',
          method: 'PATCH',
          body: JSON.stringify({ description: null }),
        },
        {
          path: 'http://project-service.test/internal/projects/project%201',
          method: 'DELETE',
          body: undefined,
        },
      ],
    );
    for (const request of requests) {
      assert.equal(request.headers.get('x-authenticated-user-id'), context.userId);
      assert.equal(request.headers.get('x-correlation-id'), context.correlationId);
      assert.equal(request.headers.get('x-internal-service-secret'), 'test-internal-secret');
    }
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironmentVariable('PROJECT_SERVICE_URL', originalUrl);
    restoreEnvironmentVariable('INTERNAL_SERVICE_SECRET', originalSecret);
  }
});

test('preserves a downstream Project error response', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.PROJECT_SERVICE_URL;
  process.env.PROJECT_SERVICE_URL = 'http://project-service.test';
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        code: 'PROJECT_NAME_ALREADY_EXISTS',
        message: 'Project name already exists inside this workspace',
        details: { name: 'duplicate' },
      }),
      { status: 409 },
    )) as typeof fetch;

  try {
    const adapter = new ProjectServiceAdapter();
    await assert.rejects(
      adapter.createProject(
        'workspace-1',
        { name: 'Learning', key: 'LRN' },
        { userId: 'user-1', correlationId: 'req-1' },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { statusCode?: number }).statusCode, 409);
        assert.equal((error as Error & { code?: string }).code, 'PROJECT_NAME_ALREADY_EXISTS');
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironmentVariable('PROJECT_SERVICE_URL', originalUrl);
  }
});

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
