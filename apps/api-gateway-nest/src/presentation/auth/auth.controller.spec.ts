import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from '../../services/auth.service';
import { AppException } from '../../common/errors/app.exception';

function fixture(fail = false) {
  const calls: unknown[] = [];
  const headers = new Map<string, string>();
  const service = {
    logout: async (body: unknown) => { calls.push(body); if (fail) throw new Error('IAM unavailable'); },
    refresh: async (body: unknown) => { calls.push(body); if (fail) throw new Error('IAM unavailable'); return { accessToken: 'access', refreshToken: 'rotated', user: { id: 'user' } }; },
  } as unknown as AuthService;
  const reply = { header: (name: string, value: string) => headers.set(name, value) } as unknown as FastifyReply;
  const request = { headers: { cookie: 'other=value; refresh_token=session%2Btoken', 'x-correlation-id': 'correlation' } } as unknown as FastifyRequest;
  return { controller: new AuthController(service), calls, headers, reply, request };
}

test('logout forwards the cookie token for revocation and expires the cookie', async () => {
  const f = fixture();
  await f.controller.logout(f.request, f.reply);
  assert.deepEqual(f.calls, [{ refreshToken: 'session+token' }]);
  assert.match(f.headers.get('set-cookie')!, /HttpOnly.*Max-Age=0/);
});

test('logout without a cookie is an idempotent no-op; IAM failure still clears it', async () => {
  const f = fixture(true);
  await assert.rejects(f.controller.logout(f.request, f.reply), /IAM unavailable/);
  assert.match(f.headers.get('set-cookie')!, /Max-Age=0/);
  f.calls.length = 0;
  await f.controller.logout({ headers: {} } as FastifyRequest, f.reply);
  assert.deepEqual(f.calls, []);
});

test('refresh forwards the cookie and returns a rotated HttpOnly cookie without exposing its token', async () => {
  const f = fixture();
  const result = await f.controller.refresh(f.request, f.reply);
  assert.deepEqual(f.calls, [{ refreshToken: 'session+token' }]);
  assert.deepEqual(result, { accessToken: 'access', user: { id: 'user' } });
  assert.match(f.headers.get('set-cookie')!, /refresh_token=rotated; HttpOnly/);
});

test('refresh rejects a missing cookie and clears one rejected by IAM', async () => {
  const f = fixture(true);
  await assert.rejects(f.controller.refresh({ headers: {} } as FastifyRequest, f.reply), /Refresh token is required/);
  assert.deepEqual(f.calls, []);
  await assert.rejects(f.controller.refresh(f.request, f.reply), /IAM unavailable/);
  assert.match(f.headers.get('set-cookie')!, /Max-Age=0/);
});

test('rate limiting uses the resolved client IP and does not clear a usable refresh cookie', async () => {
  let args: unknown[] = [];
  const controller = new AuthController({ refresh: async (...values: unknown[]) => {
    args = values;
    throw new AppException(429, 'RATE_LIMITED', 'Too many requests');
  } } as unknown as AuthService);
  const f = fixture();
  const request = { ...f.request, ip: '127.0.0.1', headers: { ...f.request.headers, 'x-forwarded-for': 'spoofed' } } as FastifyRequest;
  await assert.rejects(controller.refresh(request, f.reply), /Too many requests/);
  assert.equal(args[2], '127.0.0.1');
  assert.equal(f.headers.has('set-cookie'), false);
});
