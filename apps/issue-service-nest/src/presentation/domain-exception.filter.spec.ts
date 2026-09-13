import assert from 'node:assert/strict';
import test from 'node:test';
import { ArgumentsHost, Logger } from '@nestjs/common';
import { DomainExceptionFilter } from './domain-exception.filter';
import { DomainError } from '../domain/errors';

test('unexpected errors log diagnostic frames with correlation but never raw messages or request secrets', (t) => {
  const logged: string[] = [];
  t.mock.method(Logger.prototype, 'error', (value: string) => { logged.push(value); });
  let body: unknown;
  const response = { status: () => response, send: (value: unknown) => { body = value; } };
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ id: 'id', headers: { 'x-correlation-id': 'request-1', authorization: 'Bearer secret' }, body: { password: 'password-secret' } }) }) } as unknown as ArgumentsHost;
  const error = new Error('password-secret Bearer secret refresh-token-secret');
  new DomainExceptionFilter().catch(error, host);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /request-1/);
  assert.match(logged[0], /domain-exception.filter.spec/);
  assert.doesNotMatch(logged[0], /password-secret|Bearer secret|refresh-token-secret/);
  assert.deepEqual(body, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {}, correlationId: 'request-1' });
  const domain = new DomainError(409, 'CONFLICT', 'conflict');
  assert.equal(domain.name, 'DomainError');
  new DomainExceptionFilter().catch(domain, host);
  assert.equal(logged.length, 1);
});
