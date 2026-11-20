import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteAvatar, loadAvatar, squareCrop, uploadAvatar, validateAvatarFile,
} from '../blocks/header/avatar.mjs'; // eslint-disable-line import/extensions

test('validateAvatarFile allows jpg/png/webp/gif up to 10 MB', () => {
  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].forEach((type) => {
    assert.equal(validateAvatarFile({ type, size: 1000 }), '', type);
  });
  assert.match(validateAvatarFile({ type: 'image/svg+xml', size: 10 }), /JPG/);
  assert.match(validateAvatarFile({ type: 'image/png', size: 11 * 1024 * 1024 }), /10 MB/);
  assert.match(validateAvatarFile(null), /Choose/);
});

test('squareCrop centers the largest square', () => {
  assert.deepEqual(squareCrop(400, 200), { sx: 100, sy: 0, side: 200 });
  assert.deepEqual(squareCrop(100, 300), { sx: 0, sy: 100, side: 100 });
});

test('avatar API client maps 404 to no avatar and sends the image type', async () => {
  const calls = [];
  const fetchImpl = async (path, init) => {
    calls.push([init.method || 'GET', init.headers?.['content-type']]);
    if (!init.method) return { ok: false, status: 404 };
    return { ok: true, status: init.method === 'DELETE' ? 204 : 200 };
  };
  assert.equal(await loadAvatar(fetchImpl), null);
  await uploadAvatar({ type: 'image/webp' }, fetchImpl);
  await deleteAvatar(fetchImpl);
  assert.deepEqual(calls, [['GET', undefined], ['PUT', 'image/webp'], ['DELETE', undefined]]);
  await assert.rejects(uploadAvatar({ type: 'image/webp' }, async () => ({ ok: false, status: 413 })), /413/);
});
