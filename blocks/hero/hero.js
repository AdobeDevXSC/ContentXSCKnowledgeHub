import {
  fetchHubEntries, buildTopics, relDate, QUERY_EVENT, SUBMIT_EVENT, CLEAR_SEARCH_EVENT,
} from '../../scripts/hub-index.js';

/**
 * hero block.
 * The default (image) hero is CSS-only. The `homepage` variation is the top of
 * the Knowledge Hub homepage: an eyebrow, a gradient title, and a subtitle
 * (all authored as lines in the block), plus a live search field and dynamic
 * stats. The search field broadcasts the shared QUERY_EVENT so the home-hub
 * block's article wall filters as you type.
 * @param {Element} block
 */
export default async function decorate(block) {
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

  const aurora = document.createElement('div');
  aurora.className = 'hero-aurora';
  aurora.setAttribute('aria-hidden', 'true');
  aurora.innerHTML = '<span class="b1"></span><span class="b2"></span><span class="b3"></span>';

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
  // Accent the last two words (e.g. "Knowledge Hub") with the gradient; the
  // leading words stay plain. Built from text nodes so authored text is safe.
  const words = title.textContent.trim().split(/\s+/);
  const grad = document.createElement('span');
  grad.className = 'grad';
  if (words.length > 2) {
    h.append(document.createTextNode(`${words.slice(0, -2).join(' ')} `));
    grad.textContent = words.slice(-2).join(' ');
  } else {
    grad.textContent = words.join(' ');
  }
  h.append(grad);
  wrap.append(h);

  if (subtitle) {
    const el = document.createElement('p');
    el.className = 'hero-home-subtitle';
    el.innerHTML = subtitle.innerHTML;
    wrap.append(el);
  }

  // Live search — filters the home-hub wall via the shared query event.
  const search = document.createElement('div');
  search.className = 'hero-home-search';
  search.innerHTML = `
    <span uk-icon="icon: search"></span>
    <input class="hero-home-search-input" type="text" autocomplete="off" spellcheck="false"
      placeholder="Search articles, products, acronyms…" aria-label="Search the knowledge hub">
    <button type="button" class="hero-home-clear">Clear</button>`;
  wrap.append(search);

  const input = search.querySelector('.hero-home-search-input');
  const fire = () => document.dispatchEvent(
    new CustomEvent(QUERY_EVENT, { detail: { q: input.value } }),
  );
  input.addEventListener('input', fire);
  search.querySelector('.hero-home-clear').addEventListener('click', () => {
    input.value = '';
    fire();
    input.focus();
  });
  // the home-hub clears the box when the user browses a topic instead of searching
  document.addEventListener(CLEAR_SEARCH_EVENT, () => { input.value = ''; });
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement || {}).tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement || {}).isContentEditable;
    if (e.key === '/' && !typing) {
      e.preventDefault();
      input.focus();
    } else if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      fire();
    } else if (e.key === 'Enter' && document.activeElement === input) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent(SUBMIT_EVENT));
    }
  });

  const stats = document.createElement('div');
  stats.className = 'hero-home-stats';
  wrap.append(stats);

  block.textContent = '';
  block.append(aurora, wrap);

  // Subtle cursor-follow parallax on the aurora (skipped for reduced motion).
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('pointermove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 22;
      const y = (e.clientY / window.innerHeight - 0.5) * 22;
      aurora.style.transform = `translate(${x}px, ${y}px)`;
    }, { passive: true });
  }

  // Dynamic stats from the live index.
  const entries = await fetchHubEntries();
  if (entries.length) {
    const topics = buildTopics(entries);
    const newest = entries.reduce((m, e) => Math.max(m, e.when), 0);
    stats.innerHTML = `
      <div class="hero-stat"><b>${entries.length}</b><span>articles</span></div>
      <div class="hero-stat"><b>${topics.length}</b><span>topics</span></div>
      <div class="hero-stat"><b style="font-size: 1rem">${newest ? relDate(newest) : '—'}</b><span>last updated</span></div>`;
  }
}
