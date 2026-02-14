import { fetchPlaceholders } from '../../scripts/scripts.js';

let ALL_ITEMS = [];

/* ----------------------------- */
/* Utilities */
/* ----------------------------- */

function toTitleCase(slug = '') {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function addTitle() {
  const json = await fetchPlaceholders();
  const div = document.createElement('div');
  div.className = 'nav-title';
  div.innerHTML = `<h3>${json?.navTitle || 'XSC Knowledge Hub'}</h3>`;
  return div;
}

/* ----------------------------- */
/* Data Structuring */
/* ----------------------------- */

function buildStructure(data) {
  const structure = {};

  data.forEach((item) => {
    const segments = item.path.split('/').filter(Boolean);
    const product = segments[1];

    if (!structure[product]) {
      structure[product] = {
        pages: [],
        subcategories: {},
      };
    }

    if (segments.length === 3) {
      structure[product].pages.push(item);
    }

    if (segments.length === 4) {
      const subCategory = segments[2];

      if (!structure[product].subcategories[subCategory]) {
        structure[product].subcategories[subCategory] = [];
      }

      structure[product].subcategories[subCategory].push(item);
    }
  });

  return structure;
}

/* ----------------------------- */
/* Search */
/* ----------------------------- */

function filterItems(query) {
  if (!query) return ALL_ITEMS;

  const q = query.toLowerCase();

  return ALL_ITEMS.filter((item) => {
    const title = item.title?.toLowerCase() || '';
    const path = item.path?.toLowerCase() || '';

    let tags = '';

    if (item.tags) {
      try {
        const parsed = JSON.parse(item.tags); // 👈 parse stringified array
        if (Array.isArray(parsed)) {
          tags = parsed.join(' ').toLowerCase();
        }
      } catch (e) {
        tags = String(item.tags).toLowerCase();
      }
    }

    return (
      title.includes(q) ||
      path.includes(q) ||
      tags.includes(q)
    );
  });
}

/* ----------------------------- */
/* Render */
/* ----------------------------- */

function renderNav(block, items, isSearching = false) {
  const existing = block.querySelector('.aem-parent');
  if (existing) existing.remove();

  const structure = buildStructure(items);

  const parentWrapper = document.createElement('div');
  parentWrapper.className = 'aem-parent';

  const parentTitle = document.createElement('h5');
  parentTitle.className = 'uk-heading-bullet';
  parentTitle.textContent = 'AEM';
  parentWrapper.appendChild(parentTitle);

  const topAccordion = document.createElement('ul');
  topAccordion.className = 'uk-accordion-default';
  topAccordion.setAttribute('uk-accordion', 'multiple: false; animation: false');

  Object.keys(structure).sort().forEach((product) => {
    const productLi = document.createElement('li');
    if (isSearching) {
      productLi.classList.add('uk-open');
    }

    const productToggle = document.createElement('a');
    productToggle.className = 'uk-accordion-title';
    productToggle.href = '#';
    productToggle.innerHTML = `
      ${toTitleCase(product)}
      <span uk-accordion-icon></span>
    `;

    const productContent = document.createElement('div');
    productContent.className = 'uk-accordion-content';

    const productData = structure[product];

    /* -------- Direct Pages -------- */

    if (productData.pages.length) {
      const pageList = document.createElement('ul');
      pageList.className = 'uk-nav uk-nav-default';

      productData.pages
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        .forEach((item) => {
          const li = document.createElement('li');

          if (window.location.pathname === item.path) {
            li.classList.add('uk-active');
            productLi.classList.add('uk-open');
          }

          const link = document.createElement('a');
          link.href = item.path;
          link.textContent =
            item.title || toTitleCase(item.path.split('/').pop());

          li.appendChild(link);
          pageList.appendChild(li);
        });

      productContent.appendChild(pageList);
    }

    /* -------- Subcategories -------- */

    const subcategories = productData?.subcategories;

    if (Object.keys(subcategories).length) {
      const nestedAccordion = document.createElement('ul');
      nestedAccordion.className = 'uk-accordion-default';
      nestedAccordion.setAttribute(
        'uk-accordion',
        'multiple: false; animation: false',
      );

      Object.keys(subcategories).sort().forEach((subCategory) => {
        const subLi = document.createElement('li');

        if (isSearching) {
          subLi.classList.add('uk-open');
        }

        const subToggle = document.createElement('a');
        subToggle.className = 'uk-accordion-title';
        subToggle.href = '#';
        subToggle.innerHTML = `
          ${toTitleCase(subCategory)}
          <span uk-accordion-icon></span>
        `;

        const subContent = document.createElement('div');
        subContent.className = 'uk-accordion-content';

        const navList = document.createElement('ul');
        navList.className = 'uk-nav uk-nav-default';

        subcategories[subCategory]
          .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
          .forEach((item) => {
            const li = document.createElement('li');

            if (window.location.pathname === item.path) {
              li.classList.add('uk-active');
              subLi.classList.add('uk-open');
              productLi.classList.add('uk-open');
            }

            const link = document.createElement('a');
            link.href = item.path;
            link.textContent =
              item.title || toTitleCase(item.path.split('/').pop());

            li.appendChild(link);
            navList.appendChild(li);
          });

        subContent.appendChild(navList);
        subLi.append(subToggle, subContent);
        nestedAccordion.appendChild(subLi);
      });

      productContent.appendChild(nestedAccordion);
    }

    productLi.append(productToggle, productContent);
    topAccordion.appendChild(productLi);
  });

  parentWrapper.appendChild(topAccordion);
  block.append(parentWrapper);
}

/* ----------------------------- */
/* Main Decorator */
/* ----------------------------- */

export default async function decorate(block) {
  block.append(await addTitle());

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'leftnav-search';
  searchWrapper.innerHTML = `
    <div class="uk-inline uk-width-1-1">
      <span class="uk-form-icon" uk-icon="icon: search"></span>
      <input 
        class="uk-input uk-form-small uk-border-rounded"
        type="search"
        placeholder="Filter by keyword"
      />
    </div>
  `;

  block.append(searchWrapper);

  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) throw new Error('Failed to load query-index.json');

    const json = await resp.json();
    const data = json?.data || [];

    ALL_ITEMS = data.filter(
      (item) =>
        item.path?.startsWith('/aem/') &&
        item.path !== '/aem' &&
        item.path !== '/aem/'
    );

    renderNav(block, ALL_ITEMS);

    const input = searchWrapper.querySelector('input');

    input.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      const filtered = filterItems(query);
      renderNav(block, filtered, !!query);
    });
  } catch (e) {
    console.error('Left nav failed to load', e);
  }
}
