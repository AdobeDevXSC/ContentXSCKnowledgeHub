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

  block.prepend(collapseBtn);
  wrapper.append(aside, expandBtn);
  main.insertBefore(wrapper, main.querySelector('.section'));

  const { default: decorate } = await import('../blocks/leftnav/leftnav.js');
  loadCSS(`${window.hlx.codeBasePath}/blocks/leftnav/leftnav.css`);
  await decorate(block);
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

/**
 * Sets target="_blank" and rel="noopener noreferrer" on every <a> inside
 * `root` that is NOT inside a .leftnav-container element.
 * @param {Element} root - The element to scope the search to (defaults to <main>)
 */
export function decorateMainLinks(root = document.querySelector('main')) {
  if (!root) return;
  root.querySelectorAll('a[href]').forEach((link) => {
    if (link.closest('.leftnav-container') || link.closest('.page-breadcrumb')) return;
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
];

/**
 * Fetches page metadata from the query index for the current path.
 * @returns {Promise<{author: string, lastModified: string}|null>}
 */
async function fetchPageMeta() {
  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) throw new Error(`query-index fetch failed: ${resp.status}`);
    const json = await resp.json();
    const entries = json.data || json;
    const currentPath = window.location.pathname;
    return entries.find((e) => e.path === currentPath) || null;
  } catch (error) {
    console.error('Failed to fetch query-index.json:', error);
    return null;
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
 * Converts a URL path segment to a display label.
 * @param {string} segment
 * @returns {string}
 */
function segmentToLabel(segment) {
  if (segment.toLowerCase() === 'aem') return 'AEM';
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Builds breadcrumb items from the current pathname.
 * @returns {Array<{path: string, label: string}>}
 */
function buildBreadcrumbItems() {
  const pathname = window.location.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const items = [];
  let acc = '';
  segments.forEach((seg) => {
    acc += `/${seg}`;
    items.push({ path: acc, label: segmentToLabel(seg) });
  });
  return items;
}

/**
 * Creates the breadcrumb nav element.
 * @returns {HTMLElement}
 */
function createBreadcrumb() {
  const items = buildBreadcrumbItems();
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

  const wrapper = document.createElement('div');
  wrapper.className = 'page-meta-wrapper';

  const breadcrumb = createBreadcrumb();
  wrapper.appendChild(breadcrumb);

  const indexMeta = await fetchPageMeta();
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
      if (window.self === window.top && !window.isErrorPage) await loadLeftNav(main);
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

  // Inject author + last modified banner into the first section
  const main = document.querySelector('main');
  if (main) loadPageMetaBanner(main);
}

loadPage();
