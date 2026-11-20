// Per-user avatar image, stored via the Edge Function's /api/kv proxy
// (per-user-metadata service, feature "avatar"). The service accepts JPEG/PNG/WebP
// up to 256 KB, so uploads are cropped and resized in the browser first.

export const AVATAR_ENDPOINT = '/api/kv/avatar/user/image';
export const PUBLIC_AVATAR_ENDPOINT = '/api/kv/avatar/public';
export const AVATAR_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const AVATAR_SIZE = 256;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 256 * 1024;

/** Returns an error message for an unacceptable source file, or '' when it is fine. */
export function validateAvatarFile(file) {
  if (!file) return 'Choose an image.';
  if (!AVATAR_ACCEPT.includes(file.type)) return 'Use a JPG, PNG, WebP or GIF image.';
  if (file.size > MAX_SOURCE_BYTES) return 'Image must be 10 MB or smaller.';
  return '';
}

/** Centered square crop of a width x height image. */
export function squareCrop(width, height) {
  const side = Math.min(width, height);
  return {
    sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side,
  };
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => {
  canvas.toBlob(resolve, type, quality);
});

/** Crops to a square and encodes a small WebP (or JPEG where WebP encoding is unsupported). */
export async function prepareAvatar(file, doc = document) {
  const bitmap = await createImageBitmap(file);
  const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
  const size = Math.min(AVATAR_SIZE, side);
  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  // eslint-disable-next-line no-restricted-syntax
  for (const quality of [0.9, 0.8, 0.65, 0.5]) {
    // eslint-disable-next-line no-await-in-loop
    let blob = await toBlob(canvas, 'image/webp', quality);
    // eslint-disable-next-line no-await-in-loop
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error('Could not shrink that image enough. Try a different one.');
}

/** Returns the avatar Blob, or null when the user has none. */
export async function loadAvatar(fetchImpl = fetch) {
  const response = await fetchImpl(AVATAR_ENDPOINT, { credentials: 'same-origin', cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`avatar request failed (${response.status})`);
  return response.blob();
}

export async function uploadAvatar(blob, fetchImpl = fetch) {
  const response = await fetchImpl(AVATAR_ENDPOINT, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': blob.type },
    body: blob,
  });
  if (!response.ok) throw new Error(`avatar upload failed (${response.status})`);
}

export async function deleteAvatar(fetchImpl = fetch) {
  const response = await fetchImpl(AVATAR_ENDPOINT, { method: 'DELETE', credentials: 'same-origin' });
  if (!response.ok && response.status !== 404) throw new Error(`avatar delete failed (${response.status})`);
}

/** Must match `normalizeName`/`nameKey` in per-user-metadata/actions/kv/handler.js. */
export function normalizeAuthorName(name) {
  return String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function authorAvatarKey(name, subtle = globalThis.crypto.subtle) {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(normalizeAuthorName(name)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Returns the published avatar Blob for an author's display name, or null. */
export async function loadAuthorAvatar(name, fetchImpl = fetch) {
  if (!normalizeAuthorName(name)) return null;
  const key = await authorAvatarKey(name);
  const response = await fetchImpl(`${PUBLIC_AVATAR_ENDPOINT}/${key}`, { credentials: 'same-origin' });
  if (!response.ok || !(response.headers.get('content-type') || '').startsWith('image/')) return null;
  return response.blob();
}
