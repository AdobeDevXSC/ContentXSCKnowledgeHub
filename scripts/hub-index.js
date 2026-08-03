/*
 * hub-index — shared data + helpers for the homepage blocks (hero + home-hub).
 * Both blocks read the same query-index and taxonomy logic so their counts,
 * topic labels, and colours always agree.
 */

const ACRONYMS = new Set(['aem', 'llm', 'ai', 'dm', 'msm', 'ssa', 'eds', 'da', 'voc',
  'ic', 'af', 's7', 'xsc', 'llmo', 'aio', 'ema', 'mcp', 'cms', 'bu', 'dmc', 'geo', 'aeo']);

const TOPIC_LABELS = {
  'aem-overarching': 'AEM Overarching',
  'xsc-resources': 'XSC Resources',
  'annual-events': 'Annual Events',
  'llm-optimizer': 'LLM Optimizer',
  'sites-optimizer': 'Sites Optimizer',
  'brand-concierge': 'Brand Concierge',
  'demo-scripts': 'Demo Scripts',
  'dynamic-media': 'Dynamic Media',
};

// signature colour duos assigned per topic (stable, by size rank)
export const PALETTE = [
  ['#ED2224', '#ff6a4d'], ['#7c5cff', '#b18cff'], ['#f5a623', '#ff7a45'], ['#3b82f6', '#22d3ee'],
  ['#14b8a6', '#34d399'], ['#ec4899', '#f472b6'], ['#6366f1', '#818cf8'], ['#0ea5e9', '#38bdf8'],
  ['#f43f5e', '#fb7185'], ['#a855f7', '#c084fc'], ['#22c55e', '#4ade80'], ['#eab308', '#facc15'],
];

// custom events the hero search fires and the home-hub wall listens for:
// QUERY_EVENT on every keystroke (live filter), SUBMIT_EVENT on Enter (scroll).
export const QUERY_EVENT = 'xschub:query';
export const SUBMIT_EVENT = 'xschub:submit';
// home-hub → hero: clear the search box (fired when a topic is browsed instead)
export const CLEAR_SEARCH_EVENT = 'xschub:clearsearch';

export const labelize = (seg) => seg.split('-').map((w) => {
  if (ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}).join(' ');

export const topicOf = (path) => {
  const s = path.split('/').filter(Boolean);
  if (!s.length) return 'home';
  // Dynamic Media lives under Assets in the content tree but is surfaced as
  // its own top-level topic on the homepage.
  if (s[0] === 'aem' && s[1] === 'assets' && s[2] === 'dynamic-media') return 'dynamic-media';
  return s[0] === 'aem' && s.length > 1 ? s[1] : s[0];
};

export const topicLabel = (t) => TOPIC_LABELS[t] || labelize(t);

export const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[c]));

export const relDate = (secs) => {
  if (!secs) return '';
  const days = Math.max(0, Math.round((Date.now() / 1000 - Number(secs)) / 86400));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
};

export const isContentPath = (p) => p
  && !p.startsWith('/tools/')
  && !p.includes('/non-nav/')
  && !['/nav', '/footer', '/', '/index', '/aem', '/aem/'].includes(p);

const tokenize = (s) => (s || '').toLowerCase().match(/[a-z0-9]+/g) || [];

// A term matches when a whole token equals it (short/acronym queries like
// "EMA") or a token starts with it (longer queries, so "form" finds "Forms").
export const termMatches = (term, tokens) => (term.length <= 3
  ? tokens.includes(term)
  : tokens.some((w) => w.startsWith(term)));

export function highlight(text, terms) {
  const safe = esc(text);
  const parts = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((t) => t.length >= 2);
  if (!parts.length) return safe;
  return safe.replace(new RegExp(`(${parts.join('|')})`, 'gi'), '<mark>$1</mark>');
}

export function normalizeEntries(raw) {
  return raw.filter((e) => e && isContentPath(e.path)).map((e) => {
    const t = topicOf(e.path);
    const tokens = [...new Set([
      ...tokenize(e.title),
      ...tokenize(e.description),
      ...tokenize((e.path || '').replace(/[-/]+/g, ' ')),
      ...tokenize(String(e.tags || '')),
    ])];
    return {
      title: e.title || labelize(e.path.split('/').filter(Boolean).pop() || 'Untitled'),
      path: e.path,
      desc: e.description || '',
      topic: t,
      topicLabel: topicLabel(t),
      when: Number(e.lastModified) || 0,
      tokens,
    };
  });
}

export function buildTopics(entries) {
  const counts = {};
  entries.forEach((e) => { counts[e.topic] = (counts[e.topic] || 0) + 1; });
  const topics = Object.keys(counts)
    .map((t) => ({ key: t, label: topicLabel(t), count: counts[t] }))
    .sort((a, b) => b.count - a.count);
  topics.forEach((t, i) => { t.colors = PALETTE[i % PALETTE.length]; });
  return topics;
}

export async function fetchHubEntries() {
  try {
    const r = await fetch('/query-index.json', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      const d = j.data || j;
      if (Array.isArray(d)) return normalizeEntries(d);
    }
  } catch (e) { /* offline / not published yet */ }
  return [];
}
