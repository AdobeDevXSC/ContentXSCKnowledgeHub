import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSecretsMap } from '../src/lib/secret-map.js';

test('concurrent reads share the bundled secret lookup', async () => {
  const secrets = { first: 'one', second: 'two' };
  const lookups = [];
  const store = {
    async get(key) {
      lookups.push(key);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { plaintext: () => JSON.stringify(secrets) };
    },
  };
  const state = {};

  const maps = await Promise.all([
    getSecretsMap(store, state),
    getSecretsMap(store, state),
  ]);

  assert.deepEqual(maps, [secrets, secrets]);
  assert.deepEqual(lookups, ['secrets']);
});
