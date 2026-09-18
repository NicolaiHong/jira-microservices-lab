import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRequiredSecrets } from './main';

const internal = { INTERNAL_SERVICE_SECRET: 'internal-secret' };

test('startup fails when JWT_SECRET is missing', () => {
  assert.throws(() => assertRequiredSecrets({ ...internal }), /JWT_SECRET/);
});

test('startup fails when JWT_SECRET is shorter than 32 bytes', () => {
  assert.throws(
    () => assertRequiredSecrets({ ...internal, JWT_SECRET: 'x'.repeat(31) }),
    /JWT_SECRET/,
  );
});

test('startup accepts a JWT_SECRET of at least 32 bytes', () => {
  assert.doesNotThrow(() =>
    assertRequiredSecrets({ ...internal, JWT_SECRET: 'x'.repeat(32) }),
  );
});
