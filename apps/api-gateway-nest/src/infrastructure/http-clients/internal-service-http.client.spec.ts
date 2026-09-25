import assert from 'node:assert/strict';
import test from 'node:test';
import { InternalServiceHttpClient } from './internal-service-http.client';
import { IamServiceAdapter } from './iam-service.adapter';
import { NotificationServiceAdapter } from './notification-service.adapter';
import { AppException } from '../../common/errors/app.exception';
import { assertContract } from '../../testing/contracts';

const USER_ID = 'c3d2e1f0-a9b8-4c7d-8e6f-5a4b3c2d1e0f';

test('IAM and notification adapters preserve their distinct body and identity contracts', async (t) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  });
  await new IamServiceAdapter().logout({ refreshToken: 'test-token' }, 'request-1');
  await new NotificationServiceAdapter().markRead('id / 1', { userId: 'user-1', correlationId: 'request-2' });
  assert.match(calls[0].url, /\/auth\/logout$/);
  assert.equal(calls[0].init?.body, JSON.stringify({ refreshToken: 'test-token' }));
  assert.equal(new Headers(calls[0].init?.headers).has('x-authenticated-user-id'), false);
  assert.match(calls[1].url, /\/internal\/notifications\/id%20%2F%201\/read$/);
  assert.equal(calls[1].init?.body, undefined);
  assert.equal(new Headers(calls[1].init?.headers).has('content-type'), false);
  assert.equal(new Headers(calls[1].init?.headers).get('x-authenticated-user-id'), 'user-1');
});

test('IAM auth and notification list bodies are contract-valid and reach callers unchanged', async (t) => {
  const user = { id: USER_ID, email: 'member@example.test', roles: ['MEMBER'] };
  const notification = {
    id: '9f8e7d6c5b4a39281706f5e4d3c2b1a0', userId: USER_ID, eventId: '6e5d4c3b-2a19-4807-96f5-e4d3c2b1a098',
    type: 'issue.transitioned', title: 'Issue status changed', body: 'LRN-1 moved to DONE',
    issueId: '7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a', projectId: '5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42',
    createdAt: '2026-09-25T08:00:00Z', readAt: null,
  };
  const responses: Array<[string, unknown, number]> = [
    ['http/iam.schema.json#/$defs/registerResponse', { user: { ...user, status: 'ACTIVE', emailVerified: false } }, 201],
    ['http/iam.schema.json#/$defs/sessionResponse', { accessToken: 'access', refreshToken: 'refresh', user }, 200],
    ['http/notification.schema.json#/$defs/notificationList', { items: [notification] }, 200],
  ];
  let call = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    const [ref, body, status] = responses[call++];
    assertContract(ref, body);
    return new Response(JSON.stringify(body), { status });
  });
  const credentials = { email: 'member@example.test', password: 'password-123' };
  assert.deepEqual(await new IamServiceAdapter().register(credentials, 'request-1'), responses[0][1]);
  assert.deepEqual(await new IamServiceAdapter().login(credentials, 'request-2'), responses[1][1]);
  assert.deepEqual(await new NotificationServiceAdapter().list({ userId: USER_ID, correlationId: 'request-3' }), responses[2][1]);
});

function client() {
  return new InternalServiceHttpClient({ service: 'test', baseUrl: 'http://test/', requestErrorCode: 'FAILED', requestErrorMessage: 'failed', unavailableCode: 'UNAVAILABLE', unavailableMessage: 'unavailable' });
}

test('preserves downstream status, code and details and handles malformed error bodies', async (t) => {
  const envelope = { code: 'CONFLICT', message: 'conflict', correlationId: 'req', details: { version: 2 } };
  assertContract('http/error.schema.json', envelope);
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(envelope), { status: 409 }));
  await assert.rejects(client().forward('PATCH', '/resource', {}, { correlationId: 'req' }), (e: unknown) => e instanceof AppException && e.statusCode === 409 && e.code === 'CONFLICT' && e.details.version === 2);
  fetch.mock.mockImplementation(async () => new Response('<html>failure</html>', { status: 502 }));
  await assert.rejects(client().forward('GET', '/resource', undefined, { correlationId: 'req' }), (e: unknown) => e instanceof AppException && e.statusCode === 502 && e.code === 'FAILED');
});

test('aborts slow downstream requests and does not retry', async (t) => {
  const previous = process.env.HTTP_CLIENT_TIMEOUT_MS;
  process.env.HTTP_CLIENT_TIMEOUT_MS = '5';
  const fetch = t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  try {
    await assert.rejects(client().forward('GET', '/resource', undefined, { correlationId: 'req' }), (e: unknown) => e instanceof AppException && e.code === 'UNAVAILABLE');
    assert.equal(fetch.mock.callCount(), 1);
  } finally {
    if (previous === undefined) delete process.env.HTTP_CLIENT_TIMEOUT_MS;
    else process.env.HTTP_CLIENT_TIMEOUT_MS = previous;
  }
});
