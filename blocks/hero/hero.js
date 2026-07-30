/**
 * hero block.
 * The default (image) hero is CSS-only. The `homepage` variation is
 * content-driven: it renders an eyebrow, a title, and a subtitle authored as
 * lines in the block — no search input, styled as the graphite hub hero.
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

  block.textContent = '';
  block.classList.add('grid-bg');
  block.append(wrap);
}
