import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertTransition,
  enumValue,
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  optionalText,
  requiredText,
  type Issue,
  type IssueStatus,
} from './issue';
import { DomainError } from './errors';

const validTransitions: Array<[IssueStatus, IssueStatus]> = [
  ['TODO', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'TODO'],
  ['IN_PROGRESS', 'DONE'],
  ['DONE', 'IN_PROGRESS'],
];

test('issues use the complete fixed workflow', () => {
  for (const [from, to] of validTransitions) {
    const transition = assertTransition(from, to);
    assert.equal(transition.from, from);
    assert.equal(transition.to, to);
  }
});

test('rejects invalid and same-state workflow edges', () => {
  for (const [from, to] of [
    ['TODO', 'DONE'],
    ['DONE', 'TODO'],
    ['TODO', 'TODO'],
    ['IN_PROGRESS', 'IN_PROGRESS'],
    ['DONE', 'DONE'],
  ] as Array<[IssueStatus, IssueStatus]>) {
    assert.throws(
      () => assertTransition(from, to),
      (error: unknown) =>
        error instanceof DomainError && error.code === 'INVALID_ISSUE_TRANSITION',
    );
  }
});

test('TASK, BUG, and STORY all use the same fixed workflow', () => {
  for (const type of ISSUE_TYPES) {
    const issue = { type, status: 'TODO' } as Pick<Issue, 'type' | 'status'>;
    const transition = assertTransition(issue.status, 'IN_PROGRESS');
    assert.equal(transition.to, 'IN_PROGRESS', type);
    assert.throws(
      () => assertTransition(issue.status, 'DONE'),
      (error: unknown) =>
        error instanceof DomainError && error.code === 'INVALID_ISSUE_TRANSITION',
      type,
    );
  }
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
