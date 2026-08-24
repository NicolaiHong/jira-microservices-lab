import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertTransition,
  enumValue,
  ISSUE_PRIORITIES,
  optionalText,
  requiredText,
} from './issue';
import { DomainError } from './errors';

test('allows the fixed forward workflow', () => {
  assert.doesNotThrow(() => assertTransition('TODO', 'IN_PROGRESS'));
  assert.doesNotThrow(() => assertTransition('IN_PROGRESS', 'DONE'));
});

test('rejects skipping directly from TODO to DONE', () => {
  assert.throws(
    () => assertTransition('TODO', 'DONE'),
    (error: unknown) =>
      error instanceof DomainError && error.code === 'INVALID_ISSUE_TRANSITION',
  );
});

test('normalizes enum values at the domain boundary', () => {
  assert.equal(enumValue('high', 'priority', ISSUE_PRIORITIES), 'HIGH');
});

test('rejects blank required issue text', () => {
  assert.throws(
    () => requiredText('   ', 'summary', 200),
    (error: unknown) =>
      error instanceof DomainError && error.code === 'VALIDATION_ERROR',
  );
});

test('normalizes optional descriptions without turning whitespace into a validation error', () => {
  assert.equal(optionalText(undefined, 'description', 5000), null);
  assert.equal(optionalText(null, 'description', 5000), null);
  assert.equal(optionalText('', 'description', 5000), null);
  assert.equal(optionalText('   ', 'description', 5000), null);
  assert.equal(optionalText('  Clear and concise  ', 'description', 5000), 'Clear and concise');
});
