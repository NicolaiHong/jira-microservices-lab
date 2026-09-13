import assert from 'node:assert/strict';
import test from 'node:test';
import { AppException } from '../common/errors/app.exception';
import { ProjectsService } from './projects.service';
import { IssuesService } from './issues.service';
import { NotificationsService } from './notifications.service';
import { AuthService } from './auth.service';
import { ProjectServiceAdapter } from '../infrastructure/http-clients/project-service.adapter';
import { IssueServiceAdapter } from '../infrastructure/http-clients/issue-service.adapter';
import { NotificationServiceAdapter } from '../infrastructure/http-clients/notification-service.adapter';
import { IamServiceAdapter } from '../infrastructure/http-clients/iam-service.adapter';
import { RedisRateLimitAdapter } from '../infrastructure/rate-limit/redis-rate-limit.adapter';

test('domain routing services require identity and forward context and errors without alteration', async () => {
  const calls: unknown[][] = [];
  const error = new AppException(409, 'CONFLICT', 'conflict');
  const forward = async (...args: unknown[]) => { calls.push(args); throw error; };
  const project = new ProjectsService({ getProject: forward } as unknown as ProjectServiceAdapter);
  const issue = new IssuesService({ getIssue: forward } as unknown as IssueServiceAdapter);
  const notification = new NotificationsService({ markRead: forward } as unknown as NotificationServiceAdapter);
  const operations = [
    (userId?: string) => project.getProject('id', userId, 'correlation'),
    (userId?: string) => issue.getIssue('id', userId, 'correlation'),
    (userId?: string) => notification.markRead('id', userId, 'correlation'),
  ];
  for (const operation of operations) {
    assert.throws(() => operation(), (e: unknown) => e instanceof AppException && e.statusCode === 401);
    await assert.rejects(operation('user'), (e: unknown) => e === error);
  }
  assert.deepEqual(calls, operations.map(() => ['id', { userId: 'user', correlationId: 'correlation' }]));
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
