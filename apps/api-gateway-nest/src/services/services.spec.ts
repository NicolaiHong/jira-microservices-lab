import assert from 'node:assert/strict';
import test from 'node:test';
import { AppException } from '../common/errors/app.exception';
import { ProjectsService } from './projects.service';
import { AuthService } from './auth.service';
import { ProjectServiceAdapter } from '../infrastructure/http-clients/project-service.adapter';
import { IamServiceAdapter } from '../infrastructure/http-clients/iam-service.adapter';
import { RedisRateLimitAdapter } from '../infrastructure/rate-limit/redis-rate-limit.adapter';

test('projects service requires identity and forwards context and errors without alteration', async () => {
  const calls: unknown[][] = [];
  const error = new AppException(409, 'CONFLICT', 'conflict');
  const forward = async (...args: unknown[]) => { calls.push(args); throw error; };
  const project = new ProjectsService({ getProject: forward } as unknown as ProjectServiceAdapter, {} as RedisRateLimitAdapter);
  assert.throws(() => project.getProject('id', undefined, 'correlation'), (e: unknown) => e instanceof AppException && e.statusCode === 401);
  await assert.rejects(project.getProject('id', 'user', 'correlation'), (e: unknown) => e === error);
  assert.deepEqual(calls, [['id', { userId: 'user', correlationId: 'correlation' }]]);
});

test('auth applies registration, login and refresh limits before forwarding and preserves the cookie token body', async () => {
  let limited = false;
  const keys: string[] = [];
  const forwarded: unknown[][] = [];
  const forward = async (...args: unknown[]) => { forwarded.push(args); return { accessToken: 'test' }; };
  const iam = { register: forward, login: forward, refresh: forward, logout: forward } as unknown as IamServiceAdapter;
  const limiter = {
    hit: async (key: string, limit: number) => { keys.push(key); return { limited, limit, count: 11, ttlSeconds: 60 }; },
    isAtLimit: async () => false,
  } as unknown as RedisRateLimitAdapter;
  const service = new AuthService(iam, limiter);
  const body = { refreshToken: 'cookie-token' };
  await service.refresh(body, 'correlation', '127.0.0.1');
  assert.deepEqual(forwarded, [[body, 'correlation']]);
  limited = true;
  for (const call of [() => service.refresh(body, 'correlation', '127.0.0.1'), () => service.register({}, '127.0.0.1', 'correlation'), () => service.login({}, '127.0.0.1', 'correlation')]) {
    await assert.rejects(call(), (e: unknown) => e instanceof AppException && e.code === 'RATE_LIMITED');
  }
  assert.equal(forwarded.length, 1);
  assert.deepEqual(keys, ['rate:auth:refresh:ip:127.0.0.1', 'rate:auth:refresh:ip:127.0.0.1', 'rate:auth:register:ip:127.0.0.1', 'rate:auth:login:ip:127.0.0.1']);
});

test('member additions are rate limited per authenticated user before forwarding', async () => {
  let limited = false;
  const keys: string[] = [];
  const forwarded: unknown[][] = [];
  const adapter = {
    addWorkspaceMember: async (...args: unknown[]) => { forwarded.push(args); return { member: {} }; },
  } as unknown as ProjectServiceAdapter;
  const limiter = {
    hit: async (key: string, limit: number) => { keys.push(key); return { limited, limit, count: 21, ttlSeconds: 120 }; },
  } as unknown as RedisRateLimitAdapter;
  const service = new ProjectsService(adapter, limiter);
  const body = { email: 'a@example.test', role: 'MEMBER' };

  await service.addWorkspaceMember('workspace', body, 'user', 'correlation');
  limited = true;
  await assert.rejects(
    service.addWorkspaceMember('workspace', body, 'user', 'correlation'),
    (e: unknown) => e instanceof AppException && e.statusCode === 429 && e.code === 'RATE_LIMITED',
  );
  await assert.rejects(
    service.addWorkspaceMember('workspace', body, undefined, 'correlation'),
    (e: unknown) => e instanceof AppException && e.statusCode === 401,
  );

  assert.deepEqual(forwarded, [['workspace', body, { userId: 'user', correlationId: 'correlation' }]]);
  assert.deepEqual(keys, ['rate:workspace-member-add:user:user', 'rate:workspace-member-add:user:user']);
});
