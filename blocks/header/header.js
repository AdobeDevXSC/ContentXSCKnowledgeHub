import { getMetadata, toggleTheme } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import {
  getAuthControl, getUserInitials, getUserMenuItems, isStageAuthHost,
} from './auth.mjs'; // eslint-disable-line import/extensions
import {
  deleteUserLink, loadUserLinks, MAX_TITLE_LENGTH, MAX_USER_LINKS, saveUserLink,
} from './user-links.mjs'; // eslint-disable-line import/extensions

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 1214px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * Builds the signed-in user pill and its flyout menu.
 * @param {{name?: string, email?: string}} user
 */
function buildUserMenu({ name = '', email = '' }) {
  const displayName = name.trim() || email.trim() || 'Signed in';
  const initials = getUserInitials(name, email);
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-user';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-user-toggle';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span class="nav-user-avatar" aria-hidden="true"></span><span class="nav-user-name"></span>';
  toggle.querySelector('.nav-user-avatar').textContent = initials;
  toggle.querySelector('.nav-user-name').textContent = displayName;

  const menu = document.createElement('div');
  menu.className = 'nav-user-menu';
  menu.id = 'nav-user-menu';
  menu.hidden = true;
  toggle.setAttribute('aria-controls', menu.id);
  menu.innerHTML = `
    <div class="nav-user-menu-profile">
      <span class="nav-user-avatar nav-user-avatar-lg" aria-hidden="true"></span>
      <div class="nav-user-menu-identity">
        <p class="nav-user-menu-name"></p>
        <p class="nav-user-menu-email"></p>
      </div>
    </div>
    <ul class="nav-user-menu-items"></ul>
    <hr class="nav-user-menu-divider">
    <section class="nav-user-links" aria-label="My links">
      <div class="nav-user-links-head">
        <span class="nav-user-links-label">My links</span>
        <button type="button" class="nav-user-btn nav-user-links-add" aria-expanded="false">+ Add</button>
      </div>
      <form class="nav-user-links-form" hidden>
        <input type="text" name="title" placeholder="Title" autocomplete="off">
        <input type="text" name="url" placeholder="https://…" autocomplete="off" required>
        <p class="nav-user-links-error" role="alert" hidden></p>
        <div class="nav-user-links-actions">
          <button type="button" class="nav-user-btn nav-user-links-cancel">Cancel</button>
          <button type="submit" class="nav-user-btn nav-user-links-save">Save</button>
        </div>
      </form>
      <ul class="nav-user-menu-items nav-user-links-list"></ul>
      <p class="nav-user-links-status"></p>
    </section>
    <hr class="nav-user-menu-divider">
    <ul class="nav-user-menu-items nav-user-menu-footer"></ul>`;
  menu.querySelector('.nav-user-avatar').textContent = initials;
  menu.querySelector('.nav-user-menu-name').textContent = displayName;
  const emailEl = menu.querySelector('.nav-user-menu-email');
  if (email && email !== displayName) emailEl.textContent = email;
  else emailEl.remove();

  const renderItem = (list, {
    label, href, variant, external,
  }) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (variant) link.classList.add(`nav-user-menu-${variant}`);
    if (external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    li.append(link);
    list.append(li);
    return li;
  };
  const items = getUserMenuItems();
  const signOut = items.pop();
  const [mainList] = menu.querySelectorAll('.nav-user-menu-items');
  items.forEach((item) => renderItem(mainList, item));
  renderItem(menu.querySelector('.nav-user-menu-footer'), signOut);

  const linksList = menu.querySelector('.nav-user-links-list');
  const status = menu.querySelector('.nav-user-links-status');
  const addButton = menu.querySelector('.nav-user-links-add');
  const form = menu.querySelector('.nav-user-links-form');
  const formError = menu.querySelector('.nav-user-links-error');
  const saveButton = menu.querySelector('.nav-user-links-save');
  form.elements.title.maxLength = MAX_TITLE_LENGTH;
  let userLinks = [];
  let linksLoaded = false;

  const setStatus = (text) => {
    status.textContent = text;
    status.hidden = !text;
  };
  const renderLinks = () => {
    linksList.replaceChildren();
    userLinks.forEach((link) => {
      const li = renderItem(linksList, { label: link.title, href: link.url, external: true });
      li.classList.add('nav-user-link');
      li.querySelector('a').title = link.url;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'nav-user-btn nav-user-link-remove';
      remove.setAttribute('aria-label', `Remove ${link.title}`);
      remove.textContent = '×';
      remove.addEventListener('click', async (event) => {
        event.stopPropagation();
        remove.disabled = true;
        try {
          await deleteUserLink(link.id);
          userLinks = userLinks.filter((item) => item.id !== link.id);
          renderLinks();
        } catch {
          remove.disabled = false;
          setStatus('Could not remove link. Try again.');
        }
      });
      li.append(remove);
    });
    addButton.hidden = userLinks.length >= MAX_USER_LINKS;
    if (linksLoaded) setStatus(userLinks.length ? '' : 'No links yet.');
  };
  const loadLinks = async () => {
    if (linksLoaded) return;
    linksLoaded = true;
    setStatus('Loading…');
    try {
      userLinks = await loadUserLinks();
      renderLinks();
    } catch {
      linksLoaded = false;
      setStatus('Could not load your links.');
    }
  };
  const showForm = (show) => {
    form.hidden = !show;
    addButton.setAttribute('aria-expanded', show ? 'true' : 'false');
    formError.hidden = true;
    if (show) form.elements.url.focus();
    else form.reset();
  };
  addButton.addEventListener('click', () => showForm(form.hidden));
  menu.querySelector('.nav-user-links-cancel').addEventListener('click', () => showForm(false));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    formError.hidden = true;
    try {
      const link = await saveUserLink({
        title: form.elements.title.value,
        url: form.elements.url.value,
      });
      userLinks = [...userLinks, link];
      showForm(false);
      renderLinks();
    } catch (error) {
      formError.textContent = error.message.startsWith('Enter')
        ? error.message
        : 'Could not save link. Try again.';
      formError.hidden = false;
    } finally {
      saveButton.disabled = false;
    }
  });

  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(menu.hidden);
    if (!menu.hidden) loadLinks();
  });
  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) setOpen(false);
  });
  wrapper.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  wrapper.append(toggle, menu);
  return wrapper;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand?.querySelector('.button') || navBrand?.querySelector('a');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
    // Home/brand link stays in same tab (do not open in new tab)
    brandLink.removeAttribute('target');
    brandLink.removeAttribute('rel');
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    const navSectionsList = navSections.querySelector('.default-content-wrapper > ul');
    if (navSectionsList) {
      navSectionsList.classList.add('uk-subnav');
    }
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });

      navSection.querySelectorAll('a').forEach((link) => {
        try {
          const href = link.getAttribute('href') || '';
          const path = new URL(href, window.location.origin).pathname;
          const isHomeLink = path === '/' || path === '';
          if (!isHomeLink) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          }
        } catch {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
      });
    });
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  // Grab the left nav container
  const leftNavContainer = document.querySelector('.leftnav-container .leftnav');
  const navSectionsEl = nav.querySelector('.nav-sections');

  if (leftNavContainer && navSectionsEl) {
    if (navSectionsEl) {
      const wrapper = document.createElement('div');
      wrapper.className = 'mobile-nav-wrapper leftnav';

      navSectionsEl.appendChild(wrapper);

      // Import and decorate directly into wrapper
      import('../leftnav/leftnav.js').then((module) => {
        module.default(wrapper);
      });
    }
  }

  // Theme toggle (top-right)
  let navTools = nav.querySelector('.nav-tools');
  if (!navTools) {
    navTools = document.createElement('div');
    navTools.className = 'nav-tools';
    nav.appendChild(navTools);
  }
  // nav-tools links stay in same tab (e.g. chat icon, etc.)
  navTools.querySelectorAll('a').forEach((link) => {
    link.removeAttribute('target');
    link.removeAttribute('rel');
  });
  // ⌘K command-palette trigger
  const searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.className = 'nav-search-btn';
  searchBtn.setAttribute('aria-label', 'Search');
  searchBtn.innerHTML = '<span uk-icon="icon: search"></span>';
  searchBtn.addEventListener('click', () => {
    if (typeof window.openCommandPalette === 'function') window.openCommandPalette();
  });
  navTools.appendChild(searchBtn);

  const themeToggle = document.createElement('label');
  themeToggle.className = 'theme-toggle';
  themeToggle.setAttribute('aria-label', 'Toggle dark mode');
  themeToggle.innerHTML = `
    <input type="checkbox" class="theme-toggle-input" aria-label="Dark mode" ${document.body.classList.contains('dark-mode') ? 'checked' : ''}>
    <span class="theme-toggle-slider"></span>
  `;
  themeToggle.querySelector('.theme-toggle-input').addEventListener('change', () => {
    toggleTheme();
    themeToggle.querySelector('.theme-toggle-input').checked = document.body.classList.contains('dark-mode');
  });
  navTools.appendChild(themeToggle);

  if (isStageAuthHost(window.location.hostname)) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const authLink = document.createElement('a');
    authLink.className = 'nav-auth-link';
    const signIn = getAuthControl(false, returnTo);
    authLink.href = signIn.href;
    authLink.textContent = signIn.label;
    navTools.appendChild(authLink);

    fetch('/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(`Authentication status request failed: ${response.status}`);
        return response.json();
      })
      .then((user) => {
        if (typeof user?.authenticated !== 'boolean') {
          throw new Error('Authentication status response is invalid');
        }
        if (user.authenticated) authLink.replaceWith(buildUserMenu(user));
      })
      .catch((error) => {
        // Keep the sign-in link available if status lookup fails.
        // eslint-disable-next-line no-console
        console.error('Unable to determine Knowledge Hub authentication state', error);
      });
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper uk-navbar-container';
  navWrapper.append(nav);
  block.append(navWrapper);
}
