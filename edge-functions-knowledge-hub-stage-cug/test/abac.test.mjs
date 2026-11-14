import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy } from '../src/abac.js';

test('requires an authenticated session for a protected page', () => {
  assert.deepEqual(evaluatePolicy(null, ''), {
    allowed: false,
    missing: ['logged-in'],
  });
});

test('applies the group policy sent by the protected content', () => {
  const session = { groups: ['GRP-XSCKNOWLEDGEHUB'] };
  assert.equal(
    evaluatePolicy(session, 'group:GRP-XSCKNOWLEDGEHUB').allowed,
    true,
  );
  assert.equal(
    evaluatePolicy(session, 'group:another-group').allowed,
    false,
  );
});
