import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFavoritesStore, favoriteKey, isFavoritablePage, toFavoriteList,
} from '../blocks/header/favorites.mjs'; // eslint-disable-line import/extensions

test('isFavoritablePage excludes home, search, tools, drafts, errors and opt-out', () => {
  assert.equal(isFavoritablePage('/xsc-resources/a'), true);
  ['/', '/index', '/search', '/tools/x', '/a/drafts/b'].forEach((p) => {
    assert.equal(isFavoritablePage(p), false, p);
  });
  assert.equal(isFavoritablePage('/a', { isErrorPage: true }), false);
  assert.equal(isFavoritablePage('/a', { metadata: 'Off' }), false);
});

test('favoriteKey is stable and matches the KV key pattern', async () => {
  const key = await favoriteKey('/xsc-resources/ai-tools/a-very/long/path');
  assert.match(key, /^[A-Za-z0-9_-]{1,64}$/);
  assert.equal(key, await favoriteKey('/xsc-resources/ai-tools/a-very/long/path'));
  assert.notEqual(key, await favoriteKey('/other'));
});

test('toFavoriteList sorts newest first and drops unsafe paths', () => {
  const list = toFavoriteList({
    a: { path: '/a', title: 'A', addedAt: 1 },
    b: { path: '/b', title: '', addedAt: 2 },
    x: { path: '//evil.com', title: 'X', addedAt: 3 },
  });
  assert.deepEqual(list.map((f) => [f.path, f.title]), [['/b', '/b'], ['/a', 'A']]);
});

test('store loads once, toggles with PUT/DELETE and notifies subscribers', async () => {
  const calls = [];
  const fetchImpl = async (path, init) => {
    calls.push([init.method || 'GET', path]);
    if (init.method === 'DELETE') return { ok: true, status: 204 };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const store = createFavoritesStore({ fetchImpl, now: () => 9 });
  const seen = [];
  store.subscribe((list) => seen.push(list.length));
  await Promise.all([store.load(), store.load()]);
  await store.add({ path: '/a', title: 'A' });
  assert.equal(store.has('/a'), true);
  await store.remove('/a');
  assert.equal(store.has('/a'), false);
  const key = await favoriteKey('/a');
  assert.deepEqual(calls, [
    ['GET', '/api/kv/favorites/user'],
    ['PUT', `/api/kv/favorites/user/${key}`],
    ['DELETE', `/api/kv/favorites/user/${key}`],
  ]);
  assert.deepEqual(seen, [0, 1, 0]);
});
