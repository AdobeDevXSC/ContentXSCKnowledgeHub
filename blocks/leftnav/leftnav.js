import { fetchPlaceholders } from '../../scripts/scripts.js';

function addTitle() {
  const json = fetchPlaceholders();
  const div = document.createElement('div');
  div.className = 'nav-title';
  div.innerHTML = `<h3>${json?.navTitle || 'XSC Knowledge Hub'}</h3>`;
  return div;
}

function toTitleCase(slug = '') {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default async function decorate(block) {
  block.append(addTitle());

  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) throw new Error('Failed to load query-index.json');

    const json = await resp.json();
    const data = json?.data || [];

    const filtered = data.filter((item) =>
      item.path?.startsWith('/aem/') &&
      item.path !== '/aem' &&
      item.path !== '/aem/'
    );

    // Structure:
    // {
    //   product: {
    //     pages: [],
    //     subcategories: {
    //        subCategory: []
    //     }
    //   }
    // }

    const structure = {};

    filtered.forEach((item) => {
      const segments = item.path.split('/').filter(Boolean);

      const product = segments[1];

      if (!structure[product]) {
        structure[product] = {
          pages: [],
          subcategories: {},
        };
      }

      // /aem/{product}/{page}
      if (segments.length === 3) {
        structure[product].pages.push(item);
      }

      // /aem/{product}/{sub-category}/{page}
      if (segments.length === 4) {
        const subCategory = segments[2];

        if (!structure[product].subcategories[subCategory]) {
          structure[product].subcategories[subCategory] = [];
        }

        structure[product].subcategories[subCategory].push(item);
      }
    });

    const parentWrapper = document.createElement('div');
    parentWrapper.className = 'aem-parent';

    const parentTitle = document.createElement('h5');
    parentTitle.className = 'uk-heading-bullet';
    parentTitle.textContent = 'AEM';
    parentWrapper.appendChild(parentTitle);

    const topAccordion = document.createElement('ul');
    topAccordion.className = 'uk-accordion-default';
    topAccordion.setAttribute('uk-accordion', 'multiple: false; animation: false;');

    Object.keys(structure).sort().forEach((product) => {
      const productLi = document.createElement('li');

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

      // ===== Direct Pages Under Product =====
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

      // ===== Subcategories =====
      const subcategories = productData?.subcategories;
      if (Object.keys(subcategories).length) {
        const nestedAccordion = document.createElement('ul');
        nestedAccordion.className = 'uk-accordion-default';
        nestedAccordion.setAttribute('uk-accordion', 'multiple: false; animation: false');

        Object.keys(subcategories).sort().forEach((subCategory) => {
          const subLi = document.createElement('li');

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
  } catch (e) {
    console.error('Left nav failed to load', e);
  }
}
