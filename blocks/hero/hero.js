/**
 * hero block.
 * The default (image) hero is CSS-only. The `homepage` variation is
 * content-driven: it renders an eyebrow, a title, and a subtitle authored as
 * lines in the block, plus a search field that opens the ⌘K palette — styled
 * as the graphite hub hero.
 * @param {Element} block
 */
export default function decorate(block) {
  if (!block.classList.contains('homepage')) return;

  // Authored lines, in document order, regardless of row/cell nesting.
  const lines = [...block.querySelectorAll('h1, h2, h3, h4, h5, h6, p')]
    .filter((el) => el.textContent.trim());
  if (!lines.length) return;

  // Title = first heading; fall back to the second line, then the first.
  let title = lines.find((el) => /^H[1-6]$/.test(el.tagName));
  if (!title) title = lines[1] || lines[0];
  const titleIdx = lines.indexOf(title);
  const eyebrow = lines.find((el, i) => i < titleIdx);
  const subtitle = lines.find((el, i) => i > titleIdx);

  const wrap = document.createElement('div');
  wrap.className = 'hero-home';

  if (eyebrow) {
    const el = document.createElement('p');
    el.className = 'hero-home-eyebrow';
    el.innerHTML = `<span class="hero-home-dot"></span>${eyebrow.textContent.trim()}`;
    wrap.append(el);
  }

  const h = document.createElement('h1');
  h.className = 'hero-home-title';
  h.innerHTML = title.innerHTML;
  wrap.append(h);

  if (subtitle) {
    const el = document.createElement('p');
    el.className = 'hero-home-subtitle';
    el.innerHTML = subtitle.innerHTML;
    wrap.append(el);
  }

  // Search field — opens the ⌘K command palette (full fuzzy search).
  const search = document.createElement('div');
  search.className = 'hero-home-search';
  search.setAttribute('role', 'button');
  search.setAttribute('tabindex', '0');
  search.setAttribute('aria-label', 'Search the knowledge hub');
  search.innerHTML = `
    <span uk-icon="icon: search"></span>
    <span class="hero-home-search-ph">Search the knowledge hub…</span>`;
  const openSearch = () => {
    if (typeof window.openCommandPalette === 'function') window.openCommandPalette();
  };
  search.addEventListener('click', openSearch);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSearch();
    }
  });
  wrap.append(search);

  block.textContent = '';
  block.classList.add('grid-bg');
  block.append(wrap);
}
