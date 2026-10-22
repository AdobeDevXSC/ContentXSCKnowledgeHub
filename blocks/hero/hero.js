import {
  fetchHubEntries, buildTopics, relDate, highlight, scoreEntry, termMatches, esc,
  QUERY_EVENT, SUBMIT_EVENT, CLEAR_SEARCH_EVENT,
} from '../../scripts/hub-index.js';

// how many articles the dropdown surfaces at a time
const DROPDOWN_LIMIT = 8;

/**
 * hero block.
 * The default (image) hero is CSS-only. The `homepage` variation is the top of
 * the Knowledge Hub homepage: an eyebrow, a gradient title, and a subtitle
 * (all authored as lines in the block), plus a live search field and dynamic
 * stats. The search field broadcasts the shared QUERY_EVENT so the home-hub
 * block's article wall filters as you type, AND opens a dropdown of article
 * suggestions beneath the field so a specific page is one click away.
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

  // Live search — filters the home-hub wall via the shared query event, and
  // reveals a suggestions dropdown with top-ranked articles directly below.
  const searchbox = document.createElement('div');
  searchbox.className = 'hero-home-searchbox';
  searchbox.innerHTML = `
    <div class="hero-home-search">
      <span uk-icon="icon: search"></span>
      <input class="hero-home-search-input" type="text" autocomplete="off" spellcheck="false"
        placeholder="Search articles, products, acronyms…" aria-label="Search the knowledge hub"
        aria-autocomplete="list" aria-expanded="false" aria-controls="hero-home-dropdown"
        role="combobox">
      <button type="button" class="hero-home-clear">Clear</button>
    </div>
    <div class="hero-home-dropdown" id="hero-home-dropdown" role="listbox"
      aria-label="Article suggestions" hidden></div>`;
  wrap.append(searchbox);

  const input = searchbox.querySelector('.hero-home-search-input');
  const dropdown = searchbox.querySelector('.hero-home-dropdown');

  // ---- Dropdown state ---------------------------------------------------
  let topics = []; // from buildTopics(ENTRIES) — maps topic key -> colors/label
  let entries = []; // from fetchHubEntries()
  let items = []; // current result slice shown in the dropdown
  let active = -1; // keyboard-selected index, -1 = none
  let loaded = false;

  const tokenize = (s) => (s || '').toLowerCase().match(/[a-z0-9]+/g) || [];

  function topicColor(key) {
    const t = topics.find((x) => x.key === key);
    return t ? t.colors[0] : 'var(--accent)';
  }

  function closeDropdown() {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    items = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  // scroll=true only when a keyboard arrow moved the selection — mouse-hover
  // never scrolls, or hovering a partially-visible row at the edge would nudge
  // the dropdown and clip the top row off the viewport.
  function setActive(next, scroll = false) {
    const lis = [...dropdown.querySelectorAll('.hero-home-dd-item')];
    if (!lis.length) return;
    active = (next + lis.length) % lis.length;
    lis.forEach((li, i) => li.classList.toggle('active', i === active));
    const el = lis[active];
    if (scroll) el.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', el.id);
  }

  function openArticle(i) {
    const it = items[i];
    if (it && it.path) window.location.href = it.path;
  }

  function render(q) {
    const query = q.trim().toLowerCase();
    if (!query || !loaded) { closeDropdown(); return; }

    const terms = tokenize(query);
    if (!terms.length) { closeDropdown(); return; }

    // Qualify first (AND semantics — every term must hit a token), then rank.
    // Scoring alone would pad the slot with any-term matches, so "edge functions"
    // would pick up pages that only mention "edge". termMatches is the same
    // qualifier the home-hub wall uses, so dropdown + wall never disagree.
    const scored = entries
      .filter((e) => terms.every((t) => termMatches(t, e.tokens)))
      .map((e) => ({ e, s: scoreEntry(e, query, terms) }))
      .sort((a, b) => b.s - a.s || b.e.when - a.e.when);

    if (!scored.length) { closeDropdown(); return; }

    items = scored.slice(0, DROPDOWN_LIMIT).map((r) => r.e);
    // Items are <a> links — matches .hub-card, sidesteps the global button
    // reset, and gets native click/middle-click/open-in-new-tab for free.
    dropdown.innerHTML = items.map((e, i) => `
      <a class="hero-home-dd-item" role="option" id="hero-home-dd-${i}"
        href="${esc(e.path)}" data-i="${i}" aria-selected="false">
        <span class="hero-home-dd-dot" style="background:${topicColor(e.topic)}"
          aria-hidden="true"></span>
        <span class="hero-home-dd-body">
          <span class="hero-home-dd-title">${highlight(e.title, terms)}</span>
          <span class="hero-home-dd-path">${esc(e.path)}</span>
        </span>
        <span class="hero-home-dd-tag" style="--c:${topicColor(e.topic)}">${esc(e.topicLabel)}</span>
      </a>`).join('');
    dropdown.hidden = false;
    active = -1;
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
  }

  const fire = () => document.dispatchEvent(
    new CustomEvent(QUERY_EVENT, { detail: { q: input.value } }),
  );
  input.addEventListener('input', () => {
    fire();
    render(input.value);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim() && loaded) render(input.value);
  });
  searchbox.querySelector('.hero-home-clear').addEventListener('click', () => {
    input.value = '';
    fire();
    closeDropdown();
    input.focus();
  });
  // click a dropdown row → go to that article
  dropdown.addEventListener('click', (e) => {
    const btn = e.target.closest('.hero-home-dd-item');
    if (btn) openArticle(Number(btn.dataset.i));
  });
  // keyboard-highlight on hover so the mouse and keyboard don't disagree
  dropdown.addEventListener('mousemove', (e) => {
    const btn = e.target.closest('.hero-home-dd-item');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (i !== active) setActive(i);
  });
  // close the dropdown when focus leaves the searchbox entirely
  document.addEventListener('click', (e) => {
    if (!searchbox.contains(e.target)) closeDropdown();
  });

  // the home-hub clears the box when the user browses a topic instead of searching
  document.addEventListener(CLEAR_SEARCH_EVENT, () => { input.value = ''; closeDropdown(); });

  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement || {}).tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement || {}).isContentEditable;
    if (e.key === '/' && !typing) {
      e.preventDefault();
      input.focus();
      return;
    }
    if (document.activeElement !== input) return;
    if (e.key === 'Escape') {
      // first Escape closes the dropdown; a second clears the field
      if (!dropdown.hidden) {
        e.preventDefault();
        closeDropdown();
      } else {
        input.value = '';
        fire();
      }
    } else if (e.key === 'ArrowDown' && !dropdown.hidden) {
      e.preventDefault();
      setActive(active < 0 ? 0 : active + 1, true);
    } else if (e.key === 'ArrowUp' && !dropdown.hidden) {
      e.preventDefault();
      setActive(active < 0 ? -1 : active - 1, true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!dropdown.hidden && active >= 0) {
        openArticle(active);
      } else {
        closeDropdown();
        document.dispatchEvent(new CustomEvent(SUBMIT_EVENT));
      }
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

  // Dynamic stats from the live index — and reused as the dropdown's data source.
  entries = await fetchHubEntries();
  topics = buildTopics(entries);
  loaded = true;
  if (entries.length) {
    const newest = entries.reduce((m, e) => Math.max(m, e.when), 0);
    stats.innerHTML = `
      <div class="hero-stat"><b>${entries.length}</b><span>articles</span></div>
      <div class="hero-stat"><b>${topics.length}</b><span>topics</span></div>
      <div class="hero-stat"><b style="font-size: 1rem">${newest ? relDate(newest) : '—'}</b><span>last updated</span></div>`;
  }
  // If the user already typed before the index landed, open the dropdown now.
  if (input.value.trim() && document.activeElement === input) render(input.value);
}
