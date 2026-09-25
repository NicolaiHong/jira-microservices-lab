import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectServiceAdapter } from './project-service.adapter';
import { assertContract } from '../../testing/contracts';

const WORKSPACE_ID = '0b9f2f3c-6f1e-4c0a-9a57-3f0c2d9d2a11';
const PROJECT_ID = '5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42';
const USER_ID = 'c3d2e1f0-a9b8-4c7d-8e6f-5a4b3c2d1e0f';
const project = {
  id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'Learning', key: 'LRN',
  description: null, status: 'ACTIVE', createdByUserId: USER_ID,
  createdAt: '2026-09-25T08:00:00.000+00:00', updatedAt: '2026-09-25T08:00:00.000+00:00',
};
const member = { userId: USER_ID, role: 'MEMBER', joinedAt: '2026-09-25T08:00:00.000+00:00', updatedAt: '2026-09-25T08:00:00.000+00:00' };

function projectServiceResponse(definition: string, body: unknown, status = 200): Response {
  assertContract(`http/project.schema.json#/$defs/${definition}`, body);
  return new Response(JSON.stringify(body), { status });
}

test('forwards authenticated user, correlation ID, and internal credential to Project Service', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.PROJECT_SERVICE_URL;
  const originalSecret = process.env.INTERNAL_SERVICE_SECRET;
  process.env.PROJECT_SERVICE_URL = 'http://project-service.test';
  process.env.INTERNAL_SERVICE_SECRET = 'unchanged-internal-secret';
  const workspace = { id: WORKSPACE_ID, name: 'Team', slug: 'team', ownerUserId: USER_ID, createdAt: '2026-09-25T08:00:00.000+00:00' };

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

    return projectServiceResponse('workspaceResponse', { workspace }, 201);
  }) as typeof fetch;

  try {
    const adapter = new ProjectServiceAdapter();

    const response = await adapter.createWorkspace(
      { name: 'Team', slug: 'team' },
      { userId: 'user-123', correlationId: 'req-workspace-123' },
    );

    assert.deepEqual(response, { workspace });
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

  // One contract-valid Project Service response per adapter call below, in order.
  const responses: Array<() => Response> = [
    () => projectServiceResponse('projectResponse', { project }, 201),
    () => projectServiceResponse('projectList', { items: [project] }),
    () => projectServiceResponse('project', project),
    () => projectServiceResponse('projectResponse', { project }),
    () => new Response(null, { status: 204 }),
    () => projectServiceResponse('memberList', { items: [{ ...member, email: null }] }),
    () => projectServiceResponse('memberResponse', { member }, 201),
  ];

  globalThis.fetch = (async (input, init) => {
    requests.push({
      path: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: init?.body,
    });
    return responses[requests.length - 1]();
  }) as typeof fetch;

  try {
    const adapter = new ProjectServiceAdapter();
    const context = { userId: 'user-456', correlationId: 'req-project-456' };

    assert.deepEqual(await adapter.createProject('workspace 1', { name: 'Learning', key: 'LRN' }, context), { project });
    assert.deepEqual(await adapter.listProjects('workspace 1', context), { items: [project] });
    assert.deepEqual(await adapter.getProject('project 1', context), project);
    assert.deepEqual(await adapter.updateProject('project 1', { description: null }, context), { project });
    await adapter.archiveProject('project 1', context);
    assert.deepEqual(await adapter.listWorkspaceMembers('workspace 1', context), { items: [{ ...member, email: null }] });
    assert.deepEqual(await adapter.addWorkspaceMember('workspace 1', { email: 'a@example.test', role: 'MEMBER' }, context), { member });

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
        {
          path: 'http://project-service.test/internal/workspaces/workspace%201/members',
          method: 'GET',
          body: undefined,
        },
        {
          path: 'http://project-service.test/internal/workspaces/workspace%201/members',
          method: 'POST',
          body: JSON.stringify({ email: 'a@example.test', role: 'MEMBER' }),
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
  const envelope = {
    code: 'PROJECT_NAME_ALREADY_EXISTS',
    message: 'Project name already exists inside this workspace',
    correlationId: 'req-1',
    details: { name: 'duplicate' },
  };
  assertContract('http/error.schema.json', envelope);
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(envelope), { status: 409 })) as typeof fetch;

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
        assert.deepEqual((error as Error & { details?: unknown }).details, { name: 'duplicate' });
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
