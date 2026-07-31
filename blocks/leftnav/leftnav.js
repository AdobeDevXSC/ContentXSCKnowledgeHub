import { fetchPlaceholders } from '../../scripts/scripts.js';

/* ----------------------------- */
/* Utilities */
/* ----------------------------- */

function toTitleCase(slug = '') {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatSectionTitle(slug) {
  if (slug.toLowerCase() === 'aem') return 'AEM';
  return toTitleCase(slug);
}

async function addTitle() {
  const json = await fetchPlaceholders();
  const div = document.createElement('div');
  div.className = 'nav-title';
  div.innerHTML = `<h3>${json?.navTitle || 'XSC Knowledge Hub'}</h3>`;
  return div;
}

/* ----------------------------- */
/* Data Structuring (Recursive) */
/* ----------------------------- */

function buildStructure(data) {
  const structure = {};

  data.forEach((item) => {
    const segments = item.path.split('/').filter(Boolean);
    if (!segments.length) return;

    // Pages with only one segment (e.g. "/admin/acronyms" → ['admin','acronyms'])
    // The LAST segment is always the page — it lives in its parent's __pages array.
    // Only intermediate segments create folder nodes.

    let currentLevel = structure;

    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;

      if (isLast) {
        // Store the page on the CURRENT level's implicit __pages,
        // without creating a new child node for this segment.
        if (!currentLevel.__pages) currentLevel.__pages = [];
        currentLevel.__pages.push(item);
      } else {
        // Intermediate segment → ensure a folder node exists and descend
        if (!currentLevel.__children) currentLevel.__children = {};
        if (!currentLevel.__children[segment]) {
          currentLevel.__children[segment] = {
            __pages: [],
            __children: {},
          };
        }
        currentLevel = currentLevel.__children[segment];
      }
    });
  });

  return structure;
}

/* ----------------------------- */
/* Render (Recursive) */
/* ----------------------------- */

function renderNav(block, items) {
  const wrapper = document.createElement('div');
  wrapper.className = 'aem-parent';

  const structure = buildStructure(items);
  const { el: rootAccordion } = createAccordion(structure.__children || {}, true);
  wrapper.appendChild(rootAccordion);

  block.append(wrapper);
}

/**
 * Builds an accordion <ul> for the given tree level.
 * Returns { el, hasActive } so parent levels can bubble up the active state
 * and add uk-open to their own <li> when a descendant is the current page.
 */
function createAccordion(tree, isRoot = false) {
  const ul = document.createElement('ul');
  ul.className = 'uk-accordion-default';
  ul.setAttribute('uk-accordion', 'multiple: false; animation: false');

  let anyActive = false;

  Object.keys(tree).sort().forEach((key) => {
    const node = tree[key];

    const li = document.createElement('li');

    const toggle = document.createElement('a');
    toggle.className = 'uk-accordion-title';
    toggle.href = '#';

    const displayTitle = isRoot
      ? formatSectionTitle(key)
      : toTitleCase(key);

    toggle.innerHTML = `
      ${displayTitle}
      <span uk-accordion-icon></span>
    `;

    const content = document.createElement('div');
    content.className = 'uk-accordion-content';

    let liHasActive = false;

    /* Render Pages */
    const pages = node.__pages || [];
    if (pages.length) {
      const navList = document.createElement('ul');
      navList.className = 'uk-nav uk-nav-default';

      pages
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        .forEach((item) => {
          const liItem = document.createElement('li');

          if (window.location.pathname === item.path) {
            liItem.classList.add('uk-active');
            liHasActive = true;
          }

          const link = document.createElement('a');
          link.href = item.path;
          link.textContent =
            item.title || toTitleCase(item.path.split('/').pop());

          liItem.appendChild(link);
          navList.appendChild(liItem);
        });

      content.appendChild(navList);
    }

    /* Render Children (Recursive) */
    const children = node.__children || {};
    if (Object.keys(children).length) {
      const { el: childAccordion, hasActive: childHasActive } = createAccordion(children, false);
      // If any descendant is active, this li must also open
      if (childHasActive) liHasActive = true;
      content.appendChild(childAccordion);
    }

    // Open this li if a direct page matched OR any deeper descendant matched
    if (liHasActive) {
      li.classList.add('uk-open');
      anyActive = true;
    }

    li.append(toggle, content);
    ul.appendChild(li);
  });

  return { el: ul, hasActive: anyActive };
}

/* ----------------------------- */
/* Main Decorator */
/* ----------------------------- */

export default async function decorate(block) {
  block.append(await addTitle());

  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) throw new Error('Failed to load query-index.json');

    const json = await resp.json();
    const data = json?.data || [];

    /* -------- Blacklist Filtering -------- */

    const items = data.filter((item) => {
      const path = item.path || '';

      return (
        !path.startsWith('/tools/') &&
        !path.includes('/non-nav/') &&
        path !== '/aem' &&
        path !== '/aem/' &&
        path !== '/nav'
      );
    });

    renderNav(block, items);
  } catch (e) {
    console.error('Left nav failed to load', e);
  }
}
