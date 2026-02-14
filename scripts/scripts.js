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

/**
 * load left nav
 */
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

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) {
      sessionStorage.setItem('fonts-loaded', 'true');
    }
  } catch (e) {
    // do nothing
  }
}

export async function fetchPlaceholders() {
  const endpoint = '/placeholder.json';

  try {
    const resp = await fetch(endpoint);
    if (!resp.ok) {
      throw new Error(`Failed to fetch placeholders: ${resp.status}`);
    }
    return await resp.json();
  } catch (error) {
    console.error('Error fetching placeholder.json:', error);
    return null;
  }
}

/**
 * Builds synthetic blocks
 */
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

/**
 * Decorates main
 */
export function decorateMain(main) {
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Determine if current page is a tools/preview page
 */
function isToolsOrPreviewPage() {
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);

  return (
    pathname.startsWith('/tools/') ||
    pathname.includes('/tools/') ||
    params.has('plugin') ||
    params.has('path')
  );
}

/**
 * Load Eager (LCP critical)
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  const main = doc.querySelector('main');

  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');

    // ✅ Only inject left nav on non-tools pages
    if (!isToolsOrPreviewPage()) {
      await loadLeftNav(main);
    }

    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    if (window.innerWidth >= 1000 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Load Lazy
 */
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

/**
 * Load delayed
 */
function loadDelayed() {
  window.setTimeout(() => import('./delayed.js'), 3000);
}

/**
 * Load page
 */
async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
