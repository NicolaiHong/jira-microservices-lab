import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Logger } from '@nestjs/common';
import { ProjectAccessHttpClient } from './project-access.client';
import { DomainError } from '../domain/errors';
import { assertContract } from '../testing/contracts';

const projectId = '5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42';
const userId = 'c3d2e1f0-a9b8-4c7d-8e6f-5a4b3c2d1e0f';

function projectServiceReturns(t: test.TestContext, status: number, body: unknown, ref: string) {
  assertContract(ref, body);
  t.mock.method(Logger.prototype, 'log', () => {});
  const calls: Array<{ url: string; headers: Headers }> = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(body), { status });
  });
  return calls;
}

test('reads a contract-valid access context from Project Service', async (t) => {
  const context = { projectId, workspaceId: '0b9f2f3c-6f1e-4c0a-9a57-3f0c2d9d2a11', projectKey: 'LRN', projectStatus: 'ARCHIVED', membershipRole: 'MEMBER' };
  const calls = projectServiceReturns(t, 200, context, 'http/project.schema.json#/$defs/accessContext');

  assert.deepEqual(await new ProjectAccessHttpClient().getAccess(projectId, userId, 'request-1'), context);
  assert.match(calls[0].url, new RegExp(`/internal/projects/${projectId}/access-context$`));
  assert.equal(calls[0].headers.get('x-authenticated-user-id'), userId);
  assert.equal(calls[0].headers.get('x-correlation-id'), 'request-1');
});

test('maps the documented 404 PROJECT_NOT_FOUND envelope to a domain error', async (t) => {
  projectServiceReturns(t, 404, {
    code: 'PROJECT_NOT_FOUND', message: 'Project was not found', correlationId: 'request-2', details: {},
  }, 'http/error.schema.json');

  await assert.rejects(
    new ProjectAccessHttpClient().getAccess(projectId, userId, 'request-2'),
    (error: unknown) => error instanceof DomainError && error.status === 404 && error.code === 'PROJECT_NOT_FOUND',
  );
});
