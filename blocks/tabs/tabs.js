// eslint-disable-next-line import/no-unresolved
import { toClassName } from '../../scripts/aem.js';

export default function decorate(block) {
  const tabNav = document.createElement('ul');
  tabNav.setAttribute('uk-tab', '');
  tabNav.className = 'uk-tab';

  const switcher = document.createElement('ul');
  switcher.className = 'uk-switcher uk-margin';

  [...block.children].forEach((row, i) => {
    const heading = row.firstElementChild;

    // Build tab
    const li = document.createElement('li');
    if (i === 0) li.classList.add('uk-active');

    const a = document.createElement('a');
    a.textContent = heading.textContent;

    // Prevent default link jump
    a.addEventListener('click', (e) => e.preventDefault());

    li.appendChild(a);
    tabNav.appendChild(li);

    // Build panel
    const panel = document.createElement('li');

    heading.remove(); // remove heading from panel
    panel.append(...row.children);
    switcher.appendChild(panel);
  });

  block.textContent = '';
  block.append(tabNav, switcher);
}
