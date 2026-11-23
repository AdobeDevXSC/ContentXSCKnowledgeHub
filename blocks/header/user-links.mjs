// Per-user custom links for the profile menu, stored via the Edge Function's
// /api/kv proxy (per-user-metadata service, feature "links", user scope).

export const LINKS_ENDPOINT = '/api/kv/links/user';
export const MAX_USER_LINKS = 50;
export const MAX_TITLE_LENGTH = 80;

/** Returns an absolute http(s) URL string, or '' when the input is not a safe web link. */
export function normalizeLinkUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function normalizeLinkTitle(title, url) {
  const trimmed = String(title || '').trim().slice(0, MAX_TITLE_LENGTH);
  if (trimmed) return trimmed;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Converts the stored `{ id: { title, url, created } }` document into a sorted, safe list. */
export function toLinkList(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return [];
  return Object.entries(doc)
    .map(([id, value]) => ({
      id,
      title: typeof value?.title === 'string' ? value.title : '',
      url: normalizeLinkUrl(value?.url),
      created: Number(value?.created) || 0,
    }))
    .filter((link) => link.url)
    .map((link) => ({ ...link, title: normalizeLinkTitle(link.title, link.url) }))
    .sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
}

export function newLinkId(now = Date.now(), random = Math.random) {
  return `l${now.toString(36)}${Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')}`;
}

async function request(fetchImpl, path, init = {}) {
  const response = await fetchImpl(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  if (!response.ok) throw new Error(`links request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}

export async function loadUserLinks(fetchImpl = fetch) {
  return toLinkList(await request(fetchImpl, LINKS_ENDPOINT));
}

// Links added once to specific users' My links (matched by Okta email). Users
// can remove them; removal leaves a tombstone so they are not re-added.
export const SEEDED_LINKS = [
  {
    id: 'seed-view-analytics',
    title: 'View Analytics',
    url: 'https://www5.an.adobe.com/spa/?linkId=a0e34657-0e80-4b8d-8cf8-b50a2227da4d&dpc=pnw',
    emails: [
      'bportela@adobe.com', // Bridget Portela
      'estange@adobe.com', // Emily Jansen
      'ynaka@adobe.com', // Yuji Nakagawa
    ],
  },
];

export const isSeededLinkId = (id) => SEEDED_LINKS.some((link) => link.id === id);

/** Loads the user's links, first adding any seeded links they have never had. */
export async function loadUserLinksWithSeeds(email, fetchImpl = fetch, now = Date.now()) {
  const doc = await request(fetchImpl, LINKS_ENDPOINT);
  const stored = doc && typeof doc === 'object' && !Array.isArray(doc) ? { ...doc } : {};
  const user = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const pending = user
    ? SEEDED_LINKS.filter((seed) => seed.emails.includes(user) && !(seed.id in stored))
    : [];
  await Promise.all(pending.map(async ({ id, title, url }) => {
    const link = { title, url, created: now };
    try {
      await request(fetchImpl, `${LINKS_ENDPOINT}/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(link),
      });
      stored[id] = link;
    } catch {
      // Try again on the next load.
    }
  }));
  return toLinkList(stored);
}

export async function saveUserLink({ title, url }, fetchImpl = fetch, now = Date.now()) {
  const safeUrl = normalizeLinkUrl(url);
  if (!safeUrl) throw new Error('Enter a valid http(s) link.');
  const link = { title: normalizeLinkTitle(title, safeUrl), url: safeUrl, created: now };
  const id = newLinkId(now);
  await request(fetchImpl, `${LINKS_ENDPOINT}/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(link),
  });
  return { id, ...link };
}

export async function deleteUserLink(id, fetchImpl = fetch) {
  const path = `${LINKS_ENDPOINT}/${encodeURIComponent(id)}`;
  if (isSeededLinkId(id)) {
    await request(fetchImpl, path, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removed: true }),
    });
    return;
  }
  await request(fetchImpl, path, { method: 'DELETE' });
}
