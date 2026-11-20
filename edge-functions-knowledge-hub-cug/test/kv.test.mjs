import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import {
  handleKv, isKvPath, KV_APP, KV_DEFAULT_URL, signKvRequest,
} from '../src/kv.js';

const env = { KV_SECRET: 'test-secret', PUBLIC_ORIGIN: 'https://stage.xscknowledgehub.adobe.com' };
const session = { email: 'YNaka@Adobe.com' };
const NOW = 1_700_000_000_000;

function recorder(status = 200, body = '{}', contentType = 'application/json') {
  const calls = [];
  return {
    calls,
    fetch: async (input, init) => {
      calls.push({ input, init });
      return new Response(status === 204 ? null : body, { status, headers: { 'content-type': contentType } });
    },
    now: () => NOW,
  };
}

const kvRequest = (path, init = {}) => {
  const url = new URL(`https://stage.xscknowledgehub.adobe.com${path}`);
  return [new Request(url, init), url];
};

test('isKvPath matches only the /api/kv prefix', () => {
  assert.ok(isKvPath('/api/kv'));
  assert.ok(isKvPath('/api/kv/links/user'));
  assert.ok(!isKvPath('/api/kvx'));
  assert.ok(!isKvPath('/api/other'));
});

test('signature matches the per-user-metadata service format', async () => {
  const body = new TextEncoder().encode('[{"title":"AEM"}]');
  const fields = {
    method: 'put', path: '/links/user/mine', app: KV_APP, user: 'YNaka@adobe.com', timestamp: '1700000000', body,
  };
  const payload = ['PUT', fields.path, KV_APP, 'ynaka@adobe.com', fields.timestamp,
    createHash('sha256').update(body).digest('hex')].join('\n');
  const expected = createHmac('sha256', 'test-secret').update(payload).digest('hex');
  assert.equal(await signKvRequest('test-secret', fields), expected);
});

test('forwards a signed PUT with the session email and body', async () => {
  const deps = recorder();
  const [request, url] = kvRequest('/api/kv/links/user/mine', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', origin: env.PUBLIC_ORIGIN, 'x-kv-user': 'attacker@x.com' },
    body: '[]',
  });
  const res = await handleKv(request, env, url, session, deps);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const [{ input, init }] = deps.calls;
  assert.equal(input, `${KV_DEFAULT_URL}/links/user/mine`);
  assert.equal(init.headers['x-kv-user'], 'ynaka@adobe.com');
  assert.equal(init.headers['x-kv-timestamp'], '1700000000');
  assert.equal(init.headers['content-type'], 'application/json');
  assert.equal(new TextDecoder().decode(init.body), '[]');
  assert.equal(init.headers['x-kv-signature'], await signKvRequest('test-secret', {
    method: 'PUT', path: '/links/user/mine', app: KV_APP, user: 'ynaka@adobe.com', timestamp: '1700000000', body: init.body,
  }));
});

test('rejects anonymous, cross-origin, oversized and unsupported requests', async () => {
  const deps = recorder();
  let [request, url] = kvRequest('/api/kv/links/user');
  assert.equal((await handleKv(request, env, url, null, deps)).status, 401);

  [request, url] = kvRequest('/api/kv/links/user/x', { method: 'DELETE', headers: { origin: 'https://evil.example' } });
  assert.equal((await handleKv(request, env, url, session, deps)).status, 403);

  [request, url] = kvRequest('/api/kv/avatar/user/image', { method: 'PUT', body: new Uint8Array(300 * 1024 + 1) });
  assert.equal((await handleKv(request, env, url, session, deps)).status, 413);

  [request, url] = kvRequest('/api/kv/links/user', { method: 'POST', body: '{}' });
  assert.equal((await handleKv(request, env, url, session, deps)).status, 405);

  [request, url] = kvRequest('/api/kv/links/user');
  assert.equal((await handleKv(request, { ...env, KV_SECRET: '' }, url, session, deps)).status, 503);

  assert.equal(deps.calls.length, 0);
});

test('passes through 204 and binary content types', async () => {
  const deps = recorder(204);
  let [request, url] = kvRequest('/api/kv/links/user/x', { method: 'DELETE' });
  const res = await handleKv(request, env, url, session, deps);
  assert.equal(res.status, 204);

  const image = recorder(200, new Uint8Array([1, 2, 3]), 'image/png');
  [request, url] = kvRequest('/api/kv/avatar/user/image');
  const imgRes = await handleKv(request, { ...env, KV_URL: 'https://kv.example/kv/' }, url, session, image);
  assert.equal(image.calls[0].input, 'https://kv.example/kv/avatar/user/image');
  assert.equal(imgRes.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array(await imgRes.arrayBuffer())], [1, 2, 3]);
});
