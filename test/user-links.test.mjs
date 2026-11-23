import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteUserLink, loadUserLinks, newLinkId, normalizeLinkTitle, normalizeLinkUrl, saveUserLink,
  loadUserLinksWithSeeds, toLinkList,
} from '../blocks/header/user-links.mjs'; // eslint-disable-line import/extensions

const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

test('normalizeLinkUrl adds https and rejects unsafe schemes', () => {
  assert.equal(normalizeLinkUrl('example.com/a'), 'https://example.com/a');
  assert.equal(normalizeLinkUrl(' http://x.io '), 'http://x.io/');
  assert.equal(normalizeLinkUrl(SCRIPT_URL), '');
  assert.equal(normalizeLinkUrl('data:text/html,hi'), '');
  assert.equal(normalizeLinkUrl(''), '');
});

test('normalizeLinkTitle defaults to hostname and caps length', () => {
  assert.equal(normalizeLinkTitle('', 'https://www.adobe.com/x'), 'adobe.com');
  assert.equal(normalizeLinkTitle('a'.repeat(100), 'https://x.io').length, 80);
});

test('toLinkList drops unsafe entries and sorts by created', () => {
  const list = toLinkList({
    b: { title: 'B', url: 'https://b.io', created: 2 },
    a: { title: 'A', url: 'https://a.io', created: 1 },
    bad: { title: 'X', url: SCRIPT_URL, created: 0 },
  });
  assert.deepEqual(list.map((l) => l.id), ['a', 'b']);
  assert.deepEqual(toLinkList([]), []);
});

test('newLinkId matches the KV key pattern', () => {
  assert.match(newLinkId(), /^[A-Za-z0-9_-]{1,64}$/);
});

test('API client uses the KV proxy endpoints', async () => {
  const calls = [];
  const fetchImpl = async (path, init) => {
    calls.push({ path, method: init.method || 'GET', body: init.body });
    if (init.method === 'DELETE') return { ok: true, status: 204 };
    return { ok: true, status: 200, json: async () => ({ x: { title: 'X', url: 'https://x.io', created: 1 } }) };
  };
  assert.equal((await loadUserLinks(fetchImpl)).length, 1);
  const saved = await saveUserLink({ title: '', url: 'x.io' }, fetchImpl, 5);
  assert.equal(saved.title, 'x.io');
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].path, `/api/kv/links/user/${saved.id}`);
  assert.deepEqual(JSON.parse(calls[1].body), { title: 'x.io', url: 'https://x.io/', created: 5 });
  await deleteUserLink(saved.id, fetchImpl);
  assert.equal(calls[2].method, 'DELETE');
  await assert.rejects(saveUserLink({ url: 'ftp://x' }, fetchImpl), /valid/);
  await assert.rejects(loadUserLinks(async () => ({ ok: false, status: 401 })), /401/);
});

const kvFetch = (doc) => {
  const calls = [];
  const fetchImpl = async (path, init) => {
    calls.push({ path, method: init.method || 'GET', body: init.body });
    if (init.method) return { ok: true, status: 204 };
    return { ok: true, status: 200, json: async () => doc };
  };
  return { calls, fetchImpl };
};

test('seeds View Analytics once into allowlisted users\' links', async () => {
  for (const email of ['bportela@adobe.com', 'EStange@adobe.com', 'ynaka@adobe.com']) {
    const { calls, fetchImpl } = kvFetch({});
    // eslint-disable-next-line no-await-in-loop
    const links = await loadUserLinksWithSeeds(email, fetchImpl, 7);
    assert.deepEqual(links.map((l) => [l.id, l.title]), [['seed-view-analytics', 'View Analytics']]);
    assert.ok(links[0].url.startsWith('https://www5.an.adobe.com/'));
    assert.equal(calls[1].method, 'PUT');
    assert.equal(calls[1].path, '/api/kv/links/user/seed-view-analytics');
  }
});

test('does not seed other users or re-add a removed seeded link', async () => {
  let { calls, fetchImpl } = kvFetch({});
  assert.deepEqual(await loadUserLinksWithSeeds('other@adobe.com', fetchImpl), []);
  assert.equal(calls.length, 1);

  ({ calls, fetchImpl } = kvFetch({ 'seed-view-analytics': { removed: true } }));
  assert.deepEqual(await loadUserLinksWithSeeds('ynaka@adobe.com', fetchImpl), []);
  assert.equal(calls.length, 1);
});

test('removing a seeded link stores a tombstone instead of deleting', async () => {
  const { calls, fetchImpl } = kvFetch({});
  await deleteUserLink('seed-view-analytics', fetchImpl);
  assert.equal(calls[0].method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].body), { removed: true });
});
