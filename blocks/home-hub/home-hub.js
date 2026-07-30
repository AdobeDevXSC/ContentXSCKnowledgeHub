const SECTION_LABELS = {
  aem: 'AEM',
  'xsc-resources': 'XSC Resources',
  'annual-events': 'Annual Events',
};

function labelFor(path) {
  const seg = (path || '').split('/').filter(Boolean)[0] || '';
  if (SECTION_LABELS[seg]) return SECTION_LABELS[seg];
  return seg ? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Page';
}

function formatDate(ts) {
  if (!ts) return '';
  const ms = Number(ts) * 1000;
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * home-hub — renders a "Recently updated" grid from the query index.
 * Authored content is optional; an authored first line overrides the heading.
 * @param {Element} block
 */
export default async function decorate(block) {
  const authoredTitle = block.textContent.trim();
  block.textContent = '';

  const heading = document.createElement('h2');
  heading.className = 'home-hub-title';
  heading.textContent = authoredTitle || 'Recently updated';
  block.append(heading);

  const grid = document.createElement('div');
  grid.className = 'home-hub-grid';
  block.append(grid);

  let entries = [];
  try {
    const resp = await fetch('/query-index.json');
    if (resp.ok) {
      const json = await resp.json();
      entries = json.data || json || [];
    }
  } catch (e) { /* leave the grid empty on failure */ }

  const isContent = (p) => p
    && !p.startsWith('/tools/')
    && !p.includes('/non-nav/')
    && p !== '/' && p !== '/nav' && p !== '/aem' && p !== '/aem/';

  const recent = entries
    .filter((e) => isContent(e.path) && e.lastModified)
    .sort((a, b) => Number(b.lastModified) - Number(a.lastModified))
    .slice(0, 8);

  if (!recent.length) {
    block.classList.add('home-hub-empty');
    return;
  }

  grid.innerHTML = recent.map((e) => `<a class="home-hub-item" href="${e.path}">
      <span class="home-hub-item-title">${e.title || labelFor(e.path)}</span>
      <span class="home-hub-item-foot">
        <span class="home-hub-item-tag">${labelFor(e.path)}</span>
        <span class="home-hub-item-date">${formatDate(e.lastModified)}</span>
      </span>
    </a>`).join('');
}
