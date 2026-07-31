import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  getMetadata,
} from './aem.js';

import './uikit.min.js';
import './uikit-icons.min.js';

function toggleLeftNav() {
  document.body.classList.toggle('leftnav-collapsed');
  try {
    localStorage.setItem(
      'leftnav-collapsed',
      document.body.classList.contains('leftnav-collapsed') ? 'true' : 'false',
    );
  } catch (e) { /* ignore */ }
}

/**
 * Groups all top-level content sections into a single vertical `.main-content`
 * container. `main` is a horizontal flex row on desktop (so the left nav can sit
 * beside the content); without this wrapper every section authored after a
 * section break becomes its own flex column and the sections fan out
 * horizontally. Wrapping them keeps content stacked vertically beside the nav.
 * Safe to run after `decorateSections` (which needs direct children) because
 * `loadSection`/`loadSections` locate sections with descendant selectors.
 * @param {Element} main
 */
function wrapMainContent(main) {
  if (main.querySelector(':scope > .main-content')) return;
  const sections = [...main.querySelectorAll(':scope > .section')];
  if (!sections.length) return;
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'main-content';
  main.insertBefore(contentWrapper, sections[0]);
  sections.forEach((section) => contentWrapper.append(section));
}

async function loadLeftNav(main) {
  if (localStorage.getItem('leftnav-collapsed') === 'true') {
    document.body.classList.add('leftnav-collapsed');
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'leftnav-wrapper';

  const aside = document.createElement('aside');
  aside.className = 'leftnav-container';
  const block = document.createElement('div');
  block.className = 'block leftnav';
  aside.append(block);

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'leftnav-collapse-btn';
  collapseBtn.setAttribute('aria-label', 'Collapse navigation');
  collapseBtn.innerHTML = '<span uk-icon="icon: chevron-left; ratio: 1.2"></span>';
  collapseBtn.addEventListener('click', toggleLeftNav);

  const expandBtn = document.createElement('button');
  expandBtn.type = 'button';
  expandBtn.className = 'leftnav-expand-btn';
  expandBtn.setAttribute('aria-label', 'Expand navigation');
  expandBtn.innerHTML = '<span uk-icon="icon: chevron-right; ratio: 1.2"></span>';
  expandBtn.addEventListener('click', toggleLeftNav);

  aside.prepend(collapseBtn);
  wrapper.append(aside, expandBtn);
  const contentContainer = main.querySelector(':scope > .main-content');
  main.insertBefore(wrapper, contentContainer || main.querySelector('.section'));

  const { default: decorate } = await import('../blocks/leftnav/leftnav.js');
  loadCSS(`${window.hlx.codeBasePath}/blocks/leftnav/leftnav.css`);
  await decorate(block);
}

// ---------------------------------------------------------------------------
// Shared: map a content path to its top-level area label (used by the palette)
// ---------------------------------------------------------------------------

const SECTION_LABELS = {
  aem: 'AEM',
  'xsc-resources': 'XSC Resources',
  'annual-events': 'Annual Events',
};

function sectionLabelFromPath(path) {
  const seg = (path || '').split('/').filter(Boolean)[0] || '';
  if (SECTION_LABELS[seg]) return SECTION_LABELS[seg];
  return seg ? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Page';
}

async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) { /* do nothing */ }
}

export async function fetchPlaceholders() {
  const endpoint = '/placeholder.json';
  try {
    const resp = await fetch(endpoint);
    if (!resp.ok) throw new Error(`Failed to fetch placeholders: ${resp.status}`);
    return await resp.json();
  } catch (error) {
    console.error('Error fetching placeholder.json:', error);
    return null;
  }
}

function buildAutoBlocks(main) {
  try {
    const fragments = main.querySelectorAll('a[href*="/fragments/"]');
    if (fragments.length > 0) {
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(frag.firstElementChild);
          } catch (error) {
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
  } catch (error) {
    console.error('Auto Blocking failed', error);
  }
}

// ---------------------------------------------------------------------------
// Open all links inside <main> (excluding .leftnav-container) in a new tab
// ---------------------------------------------------------------------------

// EDS internal-link hosts (*.aem.page, *.aem.live, *.hlx.page, *.hlx.live).
const EDS_HOST_RE = /\.(?:aem|hlx)\.(?:page|live)$/;

/**
 * The AEM/helix pipeline strips the domain from links whose host is an EDS
 * domain — assuming they are internal — so a link to ANOTHER EDS site ends up
 * pointing at the current domain. When the visible text kept the full URL (as
 * autolinked URLs do), restore it as the href.
 * @param {HTMLAnchorElement} link
 */
function restoreEdsLink(link) {
  const text = link.textContent.trim();
  if (!/^https?:\/\//i.test(text)) return;
  let textUrl;
  try {
    textUrl = new URL(text);
  } catch (e) {
    return;
  }
  if (EDS_HOST_RE.test(textUrl.hostname) && link.href !== textUrl.href) {
    link.href = textUrl.href;
  }
}

/**
 * Restores cross-site EDS links (see restoreEdsLink) and opens every <a> inside
 * `root` in a new tab, except links inside the left nav, breadcrumb, or home hub.
 * @param {Element} root - The element to scope the search to (defaults to <main>)
 */
export function decorateMainLinks(root = document.querySelector('main')) {
  if (!root) return;
  root.querySelectorAll('a[href]').forEach((link) => {
    restoreEdsLink(link);
    if (link.closest('.leftnav-container') || link.closest('.page-breadcrumb') || link.closest('.home-hub')) return;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}

export function decorateMain(main) {
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateMainLinks(main);
}

// ---------------------------------------------------------------------------
// Page Metadata Banner (author + lastModified)
// ---------------------------------------------------------------------------

/**
 * Pages on which the author/last-modified banner should NOT appear.
 * Add any future paths here.
 */
const PAGE_META_BANNER_EXCLUDED_PATHS = [
  '/',
  '/contact',
  '/contact-us',
];

/**
 * Fetches all query-index entries.
 * @returns {Promise<Array>}
 */
async function fetchIndexEntries() {
  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) throw new Error(`query-index fetch failed: ${resp.status}`);
    const json = await resp.json();
    return json.data || json || [];
  } catch (error) {
    console.error('Failed to fetch query-index.json:', error);
    return [];
  }
}

/**
 * Converts a Unix timestamp (seconds) to a human-readable date string.
 * e.g. 1772560358 → "January 15, 2026"
 * @param {string|number} timestamp
 * @returns {string}
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const ms = Number(timestamp) * 1000;
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Resolves a breadcrumb label for a path. Prefers the page's real title (correct
 * casing, no slug artifacts); otherwise de-slugs the segment WITHOUT capitalizing.
 * @param {string} path Full accumulated path for this crumb
 * @param {string} segment The last URL segment of that path
 * @param {Map<string, string>} titleByPath path -> page title
 * @returns {string}
 */
function segmentLabel(path, segment, titleByPath) {
  const title = titleByPath.get(path);
  if (title) return title;
  if (segment.toLowerCase() === 'aem') return 'AEM';
  return segment.replace(/-/g, ' ');
}

/**
 * Builds breadcrumb items from the current pathname.
 * @param {Map<string, string>} titleByPath path -> page title
 * @returns {Array<{path: string, label: string}>}
 */
function buildBreadcrumbItems(titleByPath) {
  const { pathname } = window.location;
  const segments = pathname.split('/').filter(Boolean);
  const items = [];
  let acc = '';
  segments.forEach((seg) => {
    acc += `/${seg}`;
    items.push({ path: acc, label: segmentLabel(acc, seg, titleByPath) });
  });
  return items;
}

/**
 * Creates the breadcrumb nav element.
 * @param {Map<string, string>} titleByPath path -> page title
 * @returns {HTMLElement}
 */
function createBreadcrumb(titleByPath) {
  const items = buildBreadcrumbItems(titleByPath);
  const nav = document.createElement('nav');
  nav.className = 'page-breadcrumb';
  nav.setAttribute('aria-label', 'Breadcrumb');
  const ol = document.createElement('ol');
  ol.className = 'page-breadcrumb-list';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'page-breadcrumb-item';
    if (i === items.length - 1) {
      li.setAttribute('aria-current', 'page');
    }
    li.textContent = item.label;
    ol.appendChild(li);
  });
  nav.appendChild(ol);
  return nav;
}

/**
 * Injects the page-meta wrapper (author/last-modified + breadcrumb) before default-content-wrapper.
 * Falls back to <meta> tags if the query-index entry has no value.
 * Skips rendering on any path listed in PAGE_META_BANNER_EXCLUDED_PATHS.
 * @param {Element} main
 */
async function loadPageMetaBanner(main) {
  if (window.isErrorPage || PAGE_META_BANNER_EXCLUDED_PATHS.includes(window.location.pathname)) return;

  const firstSection = main.querySelector('.section');
  if (!firstSection) return;

  const defaultContentWrapper = firstSection.querySelector('.default-content-wrapper');
  const insertBefore = defaultContentWrapper || firstSection.firstChild;

  const entries = await fetchIndexEntries();
  const titleByPath = new Map(entries.map((e) => [e.path, e.title]));

  const wrapper = document.createElement('div');
  wrapper.className = 'page-meta-wrapper';

  const breadcrumb = createBreadcrumb(titleByPath);
  wrapper.appendChild(breadcrumb);

  const indexMeta = entries.find((e) => e.path === window.location.pathname) || null;
  const author = (indexMeta && indexMeta.author) || getMetadata('author');
  const lastModifiedRaw = (indexMeta && indexMeta.lastModified) || getMetadata('lastModified');
  const lastModified = formatTimestamp(lastModifiedRaw);

  if (author || lastModified) {
    const banner = document.createElement('div');
    banner.className = 'page-meta-banner';

    if (author) {
      const authorEl = document.createElement('span');
      authorEl.className = 'page-meta-author';
      const authors = author.split(',').map((a) => a.trim()).filter(Boolean);
      const label = authors.length > 1 ? 'Authors' : 'Author';
      authorEl.innerHTML = `<strong>${label}:</strong> ${authors.join(', ')}`;
      banner.appendChild(authorEl);
    }

    if (lastModified) {
      const modifiedEl = document.createElement('span');
      modifiedEl.className = 'page-meta-modified';
      modifiedEl.innerHTML = `<strong>Last Modified:</strong> ${lastModified}`;
      banner.appendChild(modifiedEl);
    }

    wrapper.appendChild(banner);
  }

  firstSection.insertBefore(wrapper, insertBefore);

  if (!document.getElementById('page-meta-banner-style')) {
    const style = document.createElement('style');
    style.id = 'page-meta-banner-style';
    style.textContent = `
      .page-meta-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
        width: 100%;
        
      }
      @media (width >= 768px) {
        .page-meta-wrapper {
          flex-direction: row;
          justify-content: space-between;
          align-items: flex-start;
          margin: 1rem 0 !important;
        }
      }
      .page-meta-banner {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        gap: 0;
        padding: 0.75rem 20px !important;
        background: rgba(0, 0, 0, 0.04);
        border-left: 3px solid rgba(0, 0, 0, 0.15);
        border-radius: 0 4px 4px 0;
        font-size: 0.8125rem;
        color: #555;
        line-height: 1.4;
        width: fit-content;
        min-width: 180px;
      }
      .page-meta-banner strong {
        color: #222;
        font-weight: 600;
      }
      .page-meta-author,
      .page-meta-modified {
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }
      .page-breadcrumb {
        font-size: 0.8125rem;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .page-breadcrumb-list {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem 0.5rem;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .page-breadcrumb-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .page-breadcrumb-item:not(:last-child)::after {
        content: '/';
        color: #999;
        font-weight: 400;
      }
      .page-breadcrumb-item a {
        color: var(--link-color);
        text-decoration: none;
      }
      .page-breadcrumb-item a:hover {
        text-decoration: underline;
      }
      .page-breadcrumb-item[aria-current="page"] {
        font-weight: 600;
        color: #222;
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Global Image Lightbox
// ---------------------------------------------------------------------------

function createLightbox() {
  const overlay = document.createElement('div');
  overlay.id = 'global-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image lightbox');
  overlay.setAttribute('tabindex', '-1');

  overlay.innerHTML = `
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-content" role="document">
      <button class="lightbox-close" aria-label="Close image">&times;</button>
      <figure class="lightbox-figure">
        <img class="lightbox-img" src="" alt="" />
        <figcaption class="lightbox-caption"></figcaption>
      </figure>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #global-lightbox {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 99999;
      align-items: center;
      justify-content: center;
    }
    #global-lightbox.is-open {
      display: flex;
      padding: 2rem;
    }
    .lightbox-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      cursor: pointer;
      animation: lightbox-fade-in 0.25s ease forwards;
    }
    .lightbox-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: min(95vw, 1600px);
      max-height: 95vh;
      animation: lightbox-scale-in 0.25s ease forwards;
    }
    .lightbox-close {
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(0, 0, 0, 0.5);
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      color: rgba(0, 0, 0, 0.85);
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      padding: 0.35rem 0.65rem;
      opacity: 1;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
      margin: 0;
      padding-top: 0;
    }
    .lightbox-close:hover,
    .lightbox-close:focus {
      background: rgba(255, 255, 255, 0.95);
      border-color: rgba(0, 0, 0, 0.7);
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.2);
      color: #000;
      opacity: 1;
      outline: none;
      transform: scale(1.08);
    }
    .lightbox-figure {
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .lightbox-img {
      display: block;
      max-width: 100%;
      max-height: calc(95vh - 3rem);
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 4px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
    }
    .lightbox-caption {
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.875rem;
      text-align: center;
      max-width: 60ch;
    }
    .lightbox-caption:empty { display: none; }
    img.lightbox-trigger { cursor: zoom-in; }
    @keyframes lightbox-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes lightbox-scale-in {
      from { opacity: 0; transform: scale(0.93); }
      to   { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .lightbox-backdrop, .lightbox-content { animation: none; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);
  return overlay;
}

function openLightbox(src, alt) {
  const overlay = document.getElementById('global-lightbox') || createLightbox();
  const img = overlay.querySelector('.lightbox-img');
  const caption = overlay.querySelector('.lightbox-caption');
  img.src = src;
  img.alt = alt || '';
  caption.textContent = alt || '';
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  overlay.focus();
}

function closeLightbox() {
  const overlay = document.getElementById('global-lightbox');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  const img = overlay.querySelector('.lightbox-img');
  if (img) img.src = '';
}

function decorateLightboxImages(root = document) {
  const images = root.querySelectorAll(
    'img:not(.lightbox-trigger):not(.lightbox-img):not([data-no-lightbox])',
  );
  images.forEach((img) => {
    if (img.closest('a[href]')) return;
    if (img.width > 0 && img.width <= 32 && img.height > 0 && img.height <= 32) return;
    img.classList.add('lightbox-trigger');
    img.addEventListener('click', () => {
      const rawSrc = img.dataset.lightboxSrc || img.src;
      const url = new URL(rawSrc);
      url.searchParams.delete('width');
      url.searchParams.delete('format');
      url.searchParams.delete('optimize');
      openLightbox(url.toString(), img.dataset.lightboxAlt || img.alt || '');
    });
  });
}

function initLightbox() {
  createLightbox();
  const overlay = document.getElementById('global-lightbox');
  overlay.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  decorateLightboxImages(document);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        decorateLightboxImages(node.tagName === 'IMG' ? node.parentElement : node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// Recent pages — the last few pages visited, surfaced in the ⌘K empty state
// ---------------------------------------------------------------------------

const RECENT_PAGES_KEY = 'cmdk-recent-pages';

function recordRecentPage() {
  try {
    const path = window.location.pathname;
    if (!path || path === '/' || path === '/index' || window.isErrorPage) return;
    const title = (document.title || '').trim();
    if (!title) return;
    const prev = JSON.parse(localStorage.getItem(RECENT_PAGES_KEY) || '[]');
    const prevList = Array.isArray(prev) ? prev.filter((p) => p && p.path !== path) : [];
    const list = [{ path, title }, ...prevList].slice(0, 6);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(list));
  } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Command palette (⌘K) — global fuzzy search over the whole knowledge hub
// ---------------------------------------------------------------------------

function initCommandPalette() {
  // Skip on error pages (e.g. 404). They load a standalone HTML that does not
  // include uikit.min.css, so the modal would have no `display: none` rule and
  // render visible — and there's nothing to search on an error page anyway.
  if (window.isErrorPage || document.getElementById('cmdk-modal') || !window.UIkit) return;

  const modal = document.createElement('div');
  modal.id = 'cmdk-modal';
  modal.className = 'cmdk uk-modal';
  modal.setAttribute('uk-modal', 'bg-close: true; esc-close: true');
  modal.innerHTML = `
    <div class="uk-modal-dialog cmdk-dialog">
      <div class="cmdk-search">
        <span uk-icon="icon: search"></span>
        <input type="text" class="cmdk-input" placeholder="Search the knowledge hub…" aria-label="Search the knowledge hub" autocomplete="off" spellcheck="false" />
        <button type="button" class="cmdk-close" aria-label="Close search"><span uk-icon="icon: close"></span></button>
      </div>
      <ul class="cmdk-results" role="listbox" aria-label="Search results"></ul>
      <div class="cmdk-empty" hidden></div>
    </div>`;
  document.body.appendChild(modal);
  window.UIkit.modal(modal);
  modal.querySelector('.cmdk-close').addEventListener('click', () => window.UIkit.modal(modal).hide());

  const input = modal.querySelector('.cmdk-input');
  const results = modal.querySelector('.cmdk-results');
  const empty = modal.querySelector('.cmdk-empty');
  let data = [];
  let items = [];
  let active = -1;
  let loaded = false;

  // Recent searches (last 5, persisted) with a suggested-topics fallback.
  const RECENT_KEY = 'cmdk-recent';
  const SEARCH_SUGGESTIONS = ['AEM', 'Assets', 'Dynamic Media', 'Experience Modernization Agent', 'Experience Workspace'];

  function getRecent() {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(v) ? v.slice(0, 5) : [];
    } catch (e) { return []; }
  }

  function addRecent(term) {
    const t = (term || '').trim();
    if (!t) return;
    try {
      const list = [t, ...getRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())]
        .slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  }

  function getRecentPages() {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_PAGES_KEY) || '[]');
      return Array.isArray(v) ? v.filter((p) => p && p.path && p.title).slice(0, 6) : [];
    } catch (e) { return []; }
  }

  // Escape authored/user text before injecting into results markup, and wrap
  // matched query terms in <mark> so hits are visible in titles and paths.
  const escHtml = (s) => (s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  let highlightTerms = [];
  function highlight(text) {
    const esc = escHtml(text);
    if (!highlightTerms.length) return esc;
    const parts = highlightTerms
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
    if (!parts.length) return esc;
    return esc.replace(new RegExp(`(${parts.join('|')})`, 'gi'), '<mark class="cmdk-hl">$1</mark>');
  }

  const clearBtn = (which) => `<button type="button" class="cmdk-clear" data-clear="${which}">Clear</button>`;
  const groupLi = (label) => `<li class="cmdk-group">${label}</li>`;

  // ---- Relevance scoring ---------------------------------------------------
  // Naive `title+path+body` substring matching returned a third of the site for
  // short queries (e.g. "ema" matched "sch-ema", "d-ema-nd"). We tokenize on word
  // boundaries and score by WHERE a term hits — title/path count far more than
  // body — plus acronym matching so "ema" finds "Experience Modernization Agent"
  // (its initials) rather than every page with those three letters mid-word.
  const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'vs', 'via', 'how', 'your']);
  const tokenize = (s) => (s || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const someStartsWith = (list, prefix) => list.some((w) => w.startsWith(prefix));

  // Initials of a title, with and without stop words, so "voc" matches
  // "Voice of the Customer" and "ema" matches "Experience Modernization Agent".
  function titleAcronyms(title) {
    const words = tokenize(title);
    return [
      words.map((w) => w[0]).join(''),
      words.filter((w) => !STOP_WORDS.has(w)).map((w) => w[0]).join(''),
    ];
  }

  function buildSearchMeta(e) {
    const titleTokens = tokenize(e.title);
    const pathTokens = tokenize(e.path);
    const bodyTokens = tokenize(e.body);
    // Body word -> occurrence count, so frequent terms rank higher in a full-text
    // (body) match, e.g. a page that says "adaptive" 15 times outranks one that
    // mentions it once.
    const bodyFreq = new Map();
    bodyTokens.forEach((w) => bodyFreq.set(w, (bodyFreq.get(w) || 0) + 1));
    const [allInitials, noStopInitials] = titleAcronyms(e.title);
    return {
      titleLc: (e.title || '').toLowerCase(),
      titleTokens,
      titleSet: new Set(titleTokens),
      pathTokens,
      pathSet: new Set(pathTokens),
      pathNorm: ` ${pathTokens.join(' ')} `,
      descSet: new Set(tokenize(e.description)),
      bodyFreq,
      bodyNorm: ` ${bodyTokens.join(' ')} `,
      allInitials,
      noStopInitials,
    };
  }

  function scoreEntry(entry, query, terms) {
    const m = entry.searchMeta;
    if (!m) return 0;
    let s = 0;
    // Whole-query signals.
    if (m.titleLc === query) s += 100; // exact title
    if (query === m.allInitials || query === m.noStopInitials) {
      s += 80; // exact acronym — "ema" === initials of "Experience Modernization Agent"
    } else if (query.length >= 2
      && (m.allInitials.startsWith(query) || m.noStopInitials.startsWith(query))) {
      s += 45; // acronym prefix
    }
    // Multi-word phrase adjacency — the words appearing together is a strong
    // signal, weighted by which field they appear together in.
    if (terms.length >= 2) {
      if (m.titleLc.includes(query)) s += 50;
      else if (m.pathNorm.includes(` ${query}`)) s += 30;
      else if (m.bodyNorm.includes(` ${query}`)) s += 20;
    }
    // Per-term signals — a hit in the title/path is worth far more than in the body.
    terms.forEach((t) => {
      if (m.titleSet.has(t)) s += 30; // whole word in title
      else if (someStartsWith(m.titleTokens, t)) s += 16; // word-prefix in title
      else if (m.titleLc.includes(t)) s += 5; // substring in title (fallback)
      if (m.pathSet.has(t)) s += 12;
      else if (someStartsWith(m.pathTokens, t)) s += 5;
      if (m.descSet.has(t)) s += 8; // whole word in description
      const freq = m.bodyFreq.get(t); // whole word in body, weighted by frequency
      if (freq) s += Math.min(freq, 6) * 3;
    });
    return s;
  }

  // A term counts as present only when it hits a prominent field — title, path,
  // or description — never the body alone.
  function prominentMatch(m, t) {
    return m.titleSet.has(t)
      || someStartsWith(m.titleTokens, t)
      || m.titleLc.includes(t)
      || m.pathSet.has(t)
      || someStartsWith(m.pathTokens, t)
      || m.descSet.has(t);
  }

  // An entry qualifies only when EVERY query term is prominently present, so a
  // two-word query like "experience modernization" no longer surfaces pages that
  // merely contain the common word "experience". A whole-query acronym qualifies too.
  function qualifies(entry, query, terms) {
    const m = entry.searchMeta;
    if (!m) return false;
    if (query === m.allInitials || query === m.noStopInitials) return true;
    if (query.length >= 2 && query.indexOf(' ') === -1
      && (m.allInitials.startsWith(query) || m.noStopInitials.startsWith(query))) return true;
    return terms.every((t) => prominentMatch(m, t));
  }

  // Fallback tier: the query is present in the body content — the whole phrase
  // for multi-word queries, or a whole word for single-word queries. Used only
  // when no page qualifies prominently, so full-text noise never pollutes precise
  // title/path matches (e.g. "adaptive form" still finds the Forms Overview page).
  function bodyQualifies(entry, query, terms) {
    const m = entry.searchMeta;
    if (!m) return false;
    if (terms.length >= 2) return m.bodyNorm.includes(` ${query}`);
    return m.bodyFreq.has(terms[0]);
  }

  async function ensureData() {
    if (loaded) return;
    loaded = true;
    try {
      const resp = await fetch('/query-index.json');
      if (resp.ok) {
        const json = await resp.json();
        data = (json.data || json || []).filter((e) => e.path
          && !e.path.startsWith('/tools/')
          && !e.path.includes('/non-nav/')
          && e.path !== '/nav');
        // Precompute per-entry search tokens once, not on every keystroke.
        data.forEach((e) => { e.searchMeta = buildSearchMeta(e); });
      }
    } catch (e) { /* palette still opens, just empty */ }
  }

  function itemsHtml(list, offset = 0) {
    return list.map((it, i) => {
      const di = offset + i;
      if (it.type === 'term') {
        return `<li class="cmdk-item" role="option" data-i="${di}">
        <span class="cmdk-item-icon" uk-icon="icon: ${it.icon}"></span>
        <span class="cmdk-item-body"><span class="cmdk-item-title">${escHtml(it.term)}</span></span>
      </li>`;
      }
      const e = it.entry;
      const title = e.title || sectionLabelFromPath(e.path);
      return `<li class="cmdk-item" role="option" data-i="${di}">
        <span class="cmdk-item-icon" uk-icon="icon: file-text"></span>
        <span class="cmdk-item-body">
          <span class="cmdk-item-title">${highlight(title)}</span>
          <span class="cmdk-item-path">${highlight(e.path)}</span>
        </span>
        <span class="cmdk-item-tag">${escHtml(sectionLabelFromPath(e.path))}</span>
      </li>`;
    }).join('');
  }

  // Rich empty state (mirrors the leftnav): icon + "No results found" + the
  // query + a FluffyJaws deep link to ask the assistant about the term.
  function renderNoResults(term) {
    const message = encodeURIComponent(`Tell me more about ${term}`);
    const fluffyUrl = `https://fluffyjaws.adobe.com/?message=${message}`;
    empty.innerHTML = `
      <span class="cmdk-noresults-icon" uk-icon="icon: search; ratio: 1.4"></span>
      <p class="cmdk-noresults-text">No results found</p>
      <p class="cmdk-noresults-hint">Can't find "${escHtml(term)}"</p>
      <a class="cmdk-noresults-link" href="${fluffyUrl}"
        target="_blank" rel="noopener noreferrer">Try FluffyJaws ↗</a>`;
  }

  function render(q) {
    const query = q.trim().toLowerCase();
    const rawQuery = q.trim();

    // Empty state: recent pages, then recent searches (persisted) or suggestions.
    if (!query) {
      empty.hidden = true;
      results.hidden = false;
      highlightTerms = [];
      const recentSearches = getRecent();
      const usingRecent = recentSearches.length > 0;
      const suggestions = usingRecent ? recentSearches : SEARCH_SUGGESTIONS;
      const icon = usingRecent ? 'clock' : 'search';
      const pageItems = getRecentPages().map((p) => ({ type: 'page', entry: p }));
      const termItems = suggestions.map((t) => ({ type: 'term', term: t, icon }));
      items = [...pageItems, ...termItems];
      // Nothing pre-highlighted — selection only appears on keyboard nav.
      let html = '';
      if (pageItems.length) {
        html += groupLi(`Recent pages${clearBtn('pages')}`) + itemsHtml(pageItems, 0);
      }
      const label = usingRecent ? `Recent searches${clearBtn('searches')}` : 'Suggestions';
      html += groupLi(label) + itemsHtml(termItems, pageItems.length);
      results.innerHTML = html;
      active = -1;
      return;
    }

    // Two-tier search. Tier 1: pages with every query term in a prominent field
    // (title/path/description). Tier 2, only when Tier 1 is empty: full-text body
    // search — so "adaptive form" still finds a page whose body is about Adaptive
    // Forms, without body noise polluting precise title/path matches.
    const terms = tokenize(query);
    highlightTerms = [...new Set(terms)].filter((t) => t.length >= 2);
    let pool = data.filter((entry) => qualifies(entry, query, terms));
    if (!pool.length) pool = data.filter((entry) => bodyQualifies(entry, query, terms));
    const scored = pool
      .map((entry) => ({ entry, score: scoreEntry(entry, query, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score
        || (a.entry.title || '').localeCompare(b.entry.title || ''));
    const cutoff = scored.length ? Math.max(10, scored[0].score * 0.3) : 0;
    items = scored
      .filter((r) => r.score >= cutoff)
      .slice(0, 40)
      .map((r) => ({ type: 'page', entry: r.entry }));

    if (!items.length) {
      results.innerHTML = '';
      renderNoResults(rawQuery);
      empty.hidden = false;
      results.hidden = true;
      active = -1;
      return;
    }
    empty.hidden = true;
    results.hidden = false;
    // No item pre-highlighted — selection only appears once the user navigates
    // with the keyboard (arrow keys). Mouse users still get :hover feedback.
    results.innerHTML = itemsHtml(items, 0);
    active = -1;
  }

  function setActive(next) {
    const lis = [...results.querySelectorAll('.cmdk-item')];
    if (!lis.length) return;
    active = (next + lis.length) % lis.length;
    lis.forEach((li, i) => li.classList.toggle('active', i === active));
    lis[active].scrollIntoView({ block: 'nearest' });
  }

  function go(i) {
    const it = items[i];
    if (!it) return;
    if (it.type === 'term') {
      input.value = it.term;
      render(it.term);
      input.focus();
      return;
    }
    const { entry } = it;
    if (entry && entry.path) {
      addRecent(input.value);
      window.UIkit.modal(modal).hide();
      window.location.href = entry.path;
    }
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active < 0 ? 0 : active + 1); // first press selects the first item
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active < 0 ? -1 : active - 1); // first press selects the last item
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) go(active); // opens only once an item is keyboard-selected
    }
  });
  results.addEventListener('click', (e) => {
    const clear = e.target.closest('.cmdk-clear');
    if (clear) {
      const key = clear.dataset.clear === 'pages' ? RECENT_PAGES_KEY : RECENT_KEY;
      try { localStorage.removeItem(key); } catch (err) { /* ignore */ }
      render('');
      input.focus();
      return;
    }
    const li = e.target.closest('.cmdk-item');
    if (li) go(Number(li.dataset.i));
  });

  // Reset to the empty state BEFORE the open animation, so the modal never
  // animates in showing the previous query/results and then snaps to empty
  // (that snap is the flicker). ensureData is fire-and-forget: the empty state
  // needs no data, and once it loads we re-render if the user already typed.
  window.UIkit.util.on(modal, 'beforeshow', () => {
    input.value = '';
    render('');
    ensureData().then(() => { if (input.value.trim()) render(input.value); });
  });
  window.UIkit.util.on(modal, 'shown', () => input.focus());
  // Reset once closed — runs after the fade completes (modal already hidden),
  // so it's invisible and the palette always reopens in a clean state.
  window.UIkit.util.on(modal, 'hidden', () => {
    input.value = '';
    render('');
  });

  window.openCommandPalette = () => window.UIkit.modal(modal).show();
}

// ---------------------------------------------------------------------------
// Page lifecycle
// ---------------------------------------------------------------------------

function hideLoader() {
  document.body.classList.add('appear');
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.classList.add('loaded');
    loader.addEventListener('transitionend', () => loader.remove(), { once: true });
  }
}

async function loadEager(doc) {
  const showPage = () => { try { hideLoader(); } catch (e) { document.body.classList.add('appear'); } };
  setTimeout(showPage, 8000);
  try {
    document.documentElement.lang = 'en';
    decorateTemplateAndTheme();
    const main = doc.querySelector('main');
    if (main) {
      decorateMain(main);
      if (!window.isErrorPage) wrapMainContent(main);
      // The site homepage (root "/") hides the left nav and centers its content.
      const { pathname } = window.location;
      const isHome = pathname === '/' || pathname === '/index';
      if (isHome) document.body.classList.add('home');
      if (window.self === window.top && !window.isErrorPage && !isHome) await loadLeftNav(main);
      await loadSection(main.querySelector('.section'), waitForFirstImage);
    }
  } finally {
    showPage();
  }
}

async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);
  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();
  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));
  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // Re-run link decoration after lazy sections load, catching any
  // links injected by blocks that rendered after the eager phase.
  decorateMainLinks(main);
}

function loadDelayed() {
  window.setTimeout(() => import('./delayed.js'), 3000);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  initLightbox();
  initCommandPalette();
  recordRecentPage();

  // Inject author + last modified banner into the first section
  const main = document.querySelector('main');
  if (main) loadPageMetaBanner(main);
}

loadPage();
