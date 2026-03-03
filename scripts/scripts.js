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
} from './aem.js';

import './uikit.min.js';
import './uikit-icons.min.js';

async function loadLeftNav(main) {
  const aside = document.createElement('aside');
  aside.className = 'leftnav-container';
  const block = document.createElement('div');
  block.className = 'block leftnav';
  aside.append(block);
  main.insertBefore(aside, main.querySelector('.section'));
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

export function decorateMain(main) {
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
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
      top: -2.5rem;
      right: 0;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: #fff;
      font-size: 1.75rem;
      line-height: 1;
      cursor: pointer;
      padding: 0.35rem 0.65rem;
      opacity: 0.85;
      transition: background 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
      margin: 0;
      padding: 0 5px 5px 5px;
    }

    .lightbox-close:hover,
    .lightbox-close:focus {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.45);
      opacity: 1;
      outline: none;
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

/**
 * Decorates eligible <img> elements with lightbox click handlers.
 *
 * Skipped automatically:
 *   - Already-decorated images (.lightbox-trigger)
 *   - The lightbox image itself (.lightbox-img)
 *   - Images with data-no-lightbox attribute
 *   - Images inside <a href="..."> links
 *   - Icons / tiny images (w & h both ≤ 32px)
 *
 * Optional data attributes on any <img>:
 *   data-lightbox-src="url"   — open a different (e.g. hi-res) URL
 *   data-lightbox-alt="text"  — override the caption
 */
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

      // Remove AEM image optimization constraints for full-res display
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

  // Close on backdrop click (outside the image)
  overlay.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  // Close on × button
  overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  // Close on Escape
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  // Decorate existing images
  decorateLightboxImages(document);

  // Watch for dynamically added images (fragments, lazy sections, etc.)
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

async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    if (window.self === window.top) await loadLeftNav(main);
    await loadSection(main.querySelector('.section'), waitForFirstImage);
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
}

function loadDelayed() {
  window.setTimeout(() => import('./delayed.js'), 3000);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  initLightbox(); // ← initialise lightbox after page is ready
}

loadPage();
