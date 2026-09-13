import assert from 'node:assert/strict';
import test from 'node:test';
import { InternalServiceHttpClient } from './internal-service-http.client';
import { IamServiceAdapter } from './iam-service.adapter';
import { NotificationServiceAdapter } from './notification-service.adapter';
import { AppException } from '../../common/errors/app.exception';

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

function client() {
  return new InternalServiceHttpClient({ service: 'test', baseUrl: 'http://test/', requestErrorCode: 'FAILED', requestErrorMessage: 'failed', unavailableCode: 'UNAVAILABLE', unavailableMessage: 'unavailable' });
}

test('preserves downstream status, code and details and handles malformed error bodies', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ code: 'CONFLICT', message: 'conflict', details: { version: 2 } }), { status: 409 }));
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
