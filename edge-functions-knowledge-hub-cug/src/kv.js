/**
 * Per-user metadata proxy: `/api/kv/*` on the public host is forwarded to the
 * App Builder `per-user-metadata/kv` action (repo ynaka-adobe/per-user-metadata),
 * signed with the shared HMAC secret so the action can trust the user identity.
 * The browser never sees the secret; identity comes only from the Okta session.
 */

export const KV_PREFIX = '/api/kv';
export const KV_APP = 'knowledge-hub';
export const KV_DEFAULT_URL = 'https://3635370-perusermetadata.adobeioruntime.net/api/v1/web/per-user-metadata/kv';
export const KV_MAX_BODY_BYTES = 300 * 1024;

const ALLOWED_METHODS = ['GET', 'PUT', 'DELETE'];
const encoder = new TextEncoder();
const noStore = { 'cache-control': 'private, no-store' };

const hex = (buffer) => [...new Uint8Array(buffer)]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

export function isKvPath(pathname) {
  return pathname === KV_PREFIX || pathname.startsWith(`${KV_PREFIX}/`);
}

/**
 * Must stay byte-compatible with `sign()` in per-user-metadata/actions/kv/handler.js.
 * `name` is the URI-encoded x-kv-name value and is appended only when present.
 */
export async function signKvRequest(secret, {
  method, path, app, user, timestamp, body, name,
}) {
  const bodyHash = hex(await crypto.subtle.digest('SHA-256', body));
  const lines = [method.toUpperCase(), path, app, user.toLowerCase(), timestamp, bodyHash];
  if (name) lines.push(name);
  const payload = lines.join('\n');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

const jsonError = (status, error, extra = {}) => new Response(JSON.stringify({ error }), {
  status,
  headers: { 'content-type': 'application/json', ...noStore, ...extra },
});

/**
 * @param {Request} request
 * @param {{ KV_SECRET: string, KV_URL?: string, PUBLIC_ORIGIN: string }} env
 * @param {URL} url
 * @param {{ email?: string, name?: string } | null} session
 * @param {{ fetch: typeof fetch, now?: () => number }} deps
 */
export async function handleKv(request, env, url, session, deps) {
  const method = request.method.toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return jsonError(405, 'method not allowed', { allow: ALLOWED_METHODS.join(', ') });
  }
  if (!env.KV_SECRET) return jsonError(503, 'kv not configured');
  const user = typeof session?.email === 'string' ? session.email.trim().toLowerCase() : '';
  if (!user) return jsonError(401, 'sign in required');
  if (method !== 'GET') {
    const origin = request.headers.get('origin');
    if (origin && origin !== env.PUBLIC_ORIGIN) return jsonError(403, 'cross-origin write');
  }

  const path = url.pathname.slice(KV_PREFIX.length) || '/';
  let body = new Uint8Array(0);
  if (method === 'PUT') {
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > KV_MAX_BODY_BYTES) return jsonError(413, 'payload too large');
    body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength > KV_MAX_BODY_BYTES) return jsonError(413, 'payload too large');
  }

  const timestamp = String(Math.floor((deps.now?.() ?? Date.now()) / 1000));
  // The verified Okta display name lets the service publish the user's avatar by name.
  const name = typeof session?.name === 'string' && session.name.trim()
    ? encodeURIComponent(session.name.trim().slice(0, 200)) : '';
  const signature = await signKvRequest(env.KV_SECRET, {
    method, path, app: KV_APP, user, timestamp, body, name,
  });
  const headers = {
    'x-kv-app': KV_APP,
    'x-kv-user': user,
    'x-kv-timestamp': timestamp,
    'x-kv-signature': signature,
    ...(name ? { 'x-kv-name': name } : {}),
    accept: request.headers.get('accept') || '*/*',
  };
  const contentType = request.headers.get('content-type');
  if (method === 'PUT' && contentType) headers['content-type'] = contentType;

  const upstream = await deps.fetch(`${(env.KV_URL || KV_DEFAULT_URL).replace(/\/+$/, '')}${path}`, {
    method,
    headers,
    body: method === 'PUT' ? body : undefined,
  });
  const responseHeaders = new Headers(noStore);
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) responseHeaders.set('content-type', upstreamType);
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
