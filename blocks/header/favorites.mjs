// Per-user page favorites, stored one key per page via the Edge Function's
// /api/kv proxy (per-user-metadata service, feature "favorites", user scope).

export const FAVORITES_ENDPOINT = '/api/kv/favorites/user';
export const MAX_FAVORITES = 200;
export const MENU_FAVORITES_LIMIT = 5;

const EXCLUDED_PATHS = ['/', '/index', '/search', '/contact', '/contact-us'];

/** Whether a page may show the favorite star. */
export function isFavoritablePage(pathname, { metadata = '', isErrorPage = false } = {}) {
  if (isErrorPage || !pathname || EXCLUDED_PATHS.includes(pathname)) return false;
  if (pathname.startsWith('/tools/') || pathname.includes('/drafts/')) return false;
  return !['off', 'no', 'false'].includes(String(metadata).trim().toLowerCase());
}

/** KV keys allow only [A-Za-z0-9_-]{1,64}, so a page path maps to a SHA-256 based key. */
export async function favoriteKey(pathname, subtle = globalThis.crypto.subtle) {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(pathname));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `p${hex.slice(0, 40)}`;
}

/** Converts the stored `{ key: { path, title, addedAt } }` document into a newest-first list. */
export function toFavoriteList(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return [];
  return Object.entries(doc)
    .filter(([, v]) => typeof v?.path === 'string' && v.path.startsWith('/') && !v.path.startsWith('//'))
    .map(([key, v]) => ({
      key,
      path: v.path,
      title: (typeof v.title === 'string' && v.title.trim()) || v.path,
      addedAt: Number(v.addedAt) || 0,
    }))
    .sort((a, b) => b.addedAt - a.addedAt || a.path.localeCompare(b.path));
}

async function request(fetchImpl, path, init = {}) {
  const response = await fetchImpl(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  if (!response.ok) throw new Error(`favorites request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}

/**
 * One in-page store shared by the page star and the profile menu, so both stay
 * in sync and the favorites document is fetched at most once per page load.
 */
export function createFavoritesStore({ fetchImpl = fetch, subtle, now = Date.now } = {}) {
  let favorites = [];
  let loading = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(favorites));

  return {
    get list() { return favorites; },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    load() {
      loading ||= request(fetchImpl, FAVORITES_ENDPOINT)
        .then((doc) => { favorites = toFavoriteList(doc); emit(); return favorites; })
        .catch((error) => { loading = null; throw error; });
      return loading;
    },
    has(pathname) {
      return favorites.some((f) => f.path === pathname);
    },
    async add({ path, title }) {
      if (favorites.length >= MAX_FAVORITES) throw new Error(`You can save up to ${MAX_FAVORITES} favorites.`);
      const key = await favoriteKey(path, subtle);
      const entry = { path, title: String(title || '').trim().slice(0, 200) || path, addedAt: now() };
      await request(fetchImpl, `${FAVORITES_ENDPOINT}/${key}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entry),
      });
      favorites = [{ key, ...entry }, ...favorites.filter((f) => f.path !== path)];
      emit();
    },
    async remove(path) {
      const existing = favorites.find((f) => f.path === path);
      const key = existing?.key || await favoriteKey(path, subtle);
      await request(fetchImpl, `${FAVORITES_ENDPOINT}/${key}`, { method: 'DELETE' });
      favorites = favorites.filter((f) => f.path !== path);
      emit();
    },
  };
}
