import {
  fetchHubEntries, buildTopics, PALETTE, esc, relDate, termMatches,
  QUERY_EVENT, SUBMIT_EVENT, CLEAR_SEARCH_EVENT,
} from '../../scripts/hub-index.js';

// how many result cards to show before the "Show more" button
const PAGE = 12;

/**
 * home-hub — the browsable body of the homepage: a "Browse by topic" bento of
 * every top-level topic, plus a filterable/sortable wall of every article,
 * all built live from query-index.json. The wall also responds to the hero's
 * search field via the shared QUERY_EVENT.
 *
 * Authored content is optional; an authored first line overrides the heading.
 * @param {Element} block
 */
export default async function decorate(block) {
  const authoredTitle = block.textContent.trim();
  block.textContent = '';
  block.innerHTML = `
    <div class="hub-head">
      <h2 class="hub-title">${esc(authoredTitle) || 'Browse by topic'}</h2>
      <span class="hub-hint">Tap a topic to filter</span>
    </div>
    <div class="hub-bento" id="hubBento"></div>
    <div class="hub-filterbar" id="hubFilter"></div>
    <div class="hub-wall" id="hubWall"></div>
    <div class="hub-more" id="hubMore"></div>`;

  const $ = (s) => block.querySelector(s);

  let ENTRIES = [];
  let TOPICS = [];
  let activeTopic = null;
  let query = '';
  let sort = 'recent';
  let visible = PAGE;

  function renderBento() {
    $('#hubBento').innerHTML = TOPICS.map((t, i) => {
      const feat = i === 0 ? ' feat' : '';
      const desc = feat
        ? `<p class="hub-topic-desc">The deepest topic in the hub — ${t.count} articles covering ${esc(t.label)}.</p>`
        : '';
      return `<button type="button" class="hub-topic${feat}" data-topic="${esc(t.key)}" aria-pressed="false" style="--c1:${t.colors[0]};--c2:${t.colors[1]}">
        <span class="hub-badge">${esc(t.label)}</span>
        <span class="hub-topic-meta">
          <span class="hub-topic-count">${t.count} article${t.count === 1 ? '' : 's'}</span>
          ${desc}
        </span>
      </button>`;
    }).join('');
  }

  function renderWall() {
    const terms = query.split(/\s+/).filter(Boolean);
    const list = ENTRIES.filter((e) => {
      if (activeTopic && e.topic !== activeTopic) return false;
      return terms.every((t) => termMatches(t, e.tokens));
    });
    list.sort(sort === 'recent'
      ? (a, b) => b.when - a.when
      : (a, b) => a.title.localeCompare(b.title));

    const chips = [];
    if (activeTopic) {
      const t = TOPICS.find((x) => x.key === activeTopic);
      chips.push(`<span class="hub-chip" style="--c1:${t.colors[0]}">Topic: <b>${esc(t.label)}</b><span class="x" data-clear="topic" role="button" tabindex="0" aria-label="Clear topic filter">✕</span></span>`);
    }
    if (query) chips.push(`<span class="hub-chip">“${esc(query)}”</span>`);

    $('#hubFilter').innerHTML = `
      <span class="hub-muted">${list.length} result${list.length === 1 ? '' : 's'}</span>
      ${chips.join('')}
      <div class="hub-sort">
        <button type="button" class="hub-sort-btn${sort === 'recent' ? ' on' : ''}" data-sort="recent">Recent</button>
        <button type="button" class="hub-sort-btn${sort === 'az' ? ' on' : ''}" data-sort="az">A–Z</button>
      </div>`;

    if (!list.length) {
      $('#hubWall').innerHTML = `<div class="hub-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <p>No articles match — try another keyword.</p></div>`;
      $('#hubMore').innerHTML = '';
      return;
    }
    const pageItems = list.slice(0, visible);
    $('#hubWall').innerHTML = pageItems.map((e) => {
      const c = (TOPICS.find((x) => x.key === e.topic) || { colors: PALETTE[0] }).colors;
      return `<a class="hub-card" href="${esc(e.path)}" style="--c1:${c[0]};--c2:${c[1]}">
        <span class="hub-card-top">
          <span class="hub-tag">${esc(e.topicLabel)}</span>
          <svg class="hub-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M9 7h8v8"/></svg>
        </span>
        <span class="hub-card-title">${esc(e.title)}</span>
        ${e.desc ? `<span class="hub-card-desc">${esc(e.desc)}</span>` : ''}
        <span class="hub-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${e.when ? `Updated ${relDate(e.when)}` : ''}</span>
      </a>`;
    }).join('');

    const remaining = list.length - pageItems.length;
    $('#hubMore').innerHTML = remaining > 0
      ? `<button type="button" class="hub-more-btn" data-more>Show more <span class="hub-more-count">(${remaining})</span></button>`
      : '';
  }

  function syncTopicButtons() {
    block.querySelectorAll('.hub-topic').forEach((c) => {
      const on = c.dataset.topic === activeTopic;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setTopic(key) {
    activeTopic = activeTopic === key ? null : key;
    // browsing a topic and keyword search are mutually exclusive: selecting a
    // topic clears any active search (and its box in the hero).
    if (activeTopic && query) {
      query = '';
      document.dispatchEvent(new CustomEvent(CLEAR_SEARCH_EVENT));
    }
    syncTopicButtons();
    renderWall();
    if (activeTopic) $('#hubWall').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // topic selection + sort + clear + show-more (delegated). Changing a filter
  // resets the page size; "Show more" grows it.
  block.addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) { visible += PAGE; renderWall(); return; }
    const topic = e.target.closest('.hub-topic');
    if (topic) { visible = PAGE; setTopic(topic.dataset.topic); return; }
    const clear = e.target.closest('[data-clear="topic"]');
    if (clear) { visible = PAGE; setTopic(activeTopic); return; }
    const s = e.target.closest('[data-sort]');
    if (s) { sort = s.dataset.sort; visible = PAGE; renderWall(); }
  });

  // the hero search field drives the wall's text filter (live); Enter scrolls
  // the results into view.
  document.addEventListener(QUERY_EVENT, (e) => {
    query = ((e.detail && e.detail.q) || '').trim().toLowerCase();
    // a keyword search spans all topics, so drop any active topic filter
    if (query && activeTopic) {
      activeTopic = null;
      syncTopicButtons();
    }
    visible = PAGE;
    renderWall();
  });
  document.addEventListener(SUBMIT_EVENT, () => {
    $('#hubFilter').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // pick up any query already typed before this block finished loading
  const heroInput = document.querySelector('.hero-home-search-input');
  if (heroInput && heroInput.value) query = heroInput.value.trim().toLowerCase();

  ENTRIES = await fetchHubEntries();
  TOPICS = buildTopics(ENTRIES);
  renderBento();
  renderWall();

  if (!ENTRIES.length) {
    $('#hubWall').innerHTML = '<div class="hub-empty"><p>Couldn’t reach the index right now — try refreshing.</p></div>';
  }
}
