import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const nav = document.createElement('nav');
  nav.classList.add('bg-bg-3', 'sticky-top', 'py-4', 'py-lg-7');

  nav.innerHTML = `
  <div class="d-block d-lg-none">
    <div class="container">
      <div class="row align-items-center">
        <div class="col-3">
          <a class="btn btn-width-equal-height d-lg-none rounded-circle custom-mobile-nav-btn" data-bs-toggle="offcanvas" data-bs-target="#custom-id-dcnxspne"><svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-light-1"><path d="M2.00016 5.33333H14.0002C14.177 5.33333 14.3465 5.2631 14.4716 5.13807C14.5966 5.01305 14.6668 4.84348 14.6668 4.66667C14.6668 4.48986 14.5966 4.32029 14.4716 4.19526C14.3465 4.07024 14.177 4 14.0002 4H2.00016C1.82335 4 1.65378 4.07024 1.52876 4.19526C1.40373 4.32029 1.3335 4.48986 1.3335 4.66667C1.3335 4.84348 1.40373 5.01305 1.52876 5.13807C1.65378 5.2631 1.82335 5.33333 2.00016 5.33333ZM14.0002 10.6667H2.00016C1.82335 10.6667 1.65378 10.7369 1.52876 10.8619C1.40373 10.987 1.3335 11.1565 1.3335 11.3333C1.3335 11.5101 1.40373 11.6797 1.52876 11.8047C1.65378 11.9298 1.82335 12 2.00016 12H14.0002C14.177 12 14.3465 11.9298 14.4716 11.8047C14.5966 11.6797 14.6668 11.5101 14.6668 11.3333C14.6668 11.1565 14.5966 10.987 14.4716 10.8619C14.3465 10.7369 14.177 10.6667 14.0002 10.6667ZM14.0002 7.33333H2.00016C1.82335 7.33333 1.65378 7.40357 1.52876 7.5286C1.40373 7.65362 1.3335 7.82319 1.3335 8C1.3335 8.17681 1.40373 8.34638 1.52876 8.4714C1.65378 8.59643 1.82335 8.66667 2.00016 8.66667H14.0002C14.177 8.66667 14.3465 8.59643 14.4716 8.4714C14.5966 8.34638 14.6668 8.17681 14.6668 8C14.6668 7.82319 14.5966 7.65362 14.4716 7.5286C14.3465 7.40357 14.177 7.33333 14.0002 7.33333Z"></path></svg></a>
        </div>
        <div class="col-3">
        </div>
      </div>
    </div>
  </div>
  <div class="offcanvas offcanvas-start bg-bg-3" id="custom-id-dcnxspne" aria-hidden="true">
    <div class="offcanvas-header">
      <a class="btn btn-sm btn-width-equal-height btn-bg-3" data-bs-dismiss="offcanvas"><svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-dark-2"><path d="M8.9398 8L13.1398 3.80667C13.2653 3.68113 13.3359 3.51087 13.3359 3.33333C13.3359 3.1558 13.2653 2.98554 13.1398 2.86C13.0143 2.73447 12.844 2.66394 12.6665 2.66394C12.4889 2.66394 12.3187 2.73447 12.1931 2.86L7.9998 7.06L3.80646 2.86C3.68093 2.73447 3.51066 2.66394 3.33313 2.66394C3.1556 2.66394 2.98533 2.73447 2.8598 2.86C2.73426 2.98554 2.66374 3.1558 2.66374 3.33333C2.66374 3.51087 2.73426 3.68113 2.8598 3.80667L7.0598 8L2.8598 12.1933C2.79731 12.2553 2.74771 12.329 2.71387 12.4103C2.68002 12.4915 2.6626 12.5787 2.6626 12.6667C2.6626 12.7547 2.68002 12.8418 2.71387 12.9231C2.74771 13.0043 2.79731 13.078 2.8598 13.14C2.92177 13.2025 2.99551 13.2521 3.07675 13.2859C3.15798 13.3198 3.24512 13.3372 3.33313 13.3372C3.42114 13.3372 3.50827 13.3198 3.58951 13.2859C3.67075 13.2521 3.74449 13.2025 3.80646 13.14L7.9998 8.94L12.1931 13.14C12.2551 13.2025 12.3288 13.2521 12.4101 13.2859C12.4913 13.3198 12.5785 13.3372 12.6665 13.3372C12.7545 13.3372 12.8416 13.3198 12.9228 13.2859C13.0041 13.2521 13.0778 13.2025 13.1398 13.14C13.2023 13.078 13.2519 13.0043 13.2857 12.9231C13.3196 12.8418 13.337 12.7547 13.337 12.6667C13.337 12.5787 13.3196 12.4915 13.2857 12.4103C13.2519 12.329 13.2023 12.2553 13.1398 12.1933L8.9398 8Z"></path></svg></a>
    </div>
    <div class="offcanvas-body">
      <div class="nav-mobile">
      </div>
      <form action="" method="GET" class="mt-4">
        <div class="input-group">
          <button class="input-group-text border-end-0 border-dark-3 ps-4 pe-2"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-dark-3"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.7559 14.4767C9.92184 14.8222 9.02784 15 8.125 15C6.30164 15 4.55295 14.2757 3.26364 12.9864C1.97433 11.697 1.25 9.94836 1.25 8.125C1.25 6.30164 1.97433 4.55295 3.26364 3.26364C4.55295 1.97433 6.30164 1.25 8.125 1.25C9.02784 1.25 9.92184 1.42783 10.7559 1.77333C11.5901 2.11883 12.348 2.62524 12.9864 3.26364C13.6248 3.90204 14.1312 4.65994 14.4767 5.49405C14.8222 6.32817 15 7.22216 15 8.125C15 9.02784 14.8222 9.92184 14.4767 10.7559C14.1312 11.5901 13.6248 12.348 12.9864 12.9864C12.348 13.6248 11.5901 14.1312 10.7559 14.4767ZM14.6777 12.929C15.6929 11.5442 16.25 9.86333 16.25 8.125C16.25 5.97012 15.394 3.90349 13.8702 2.37976C12.3465 0.856024 10.2799 0 8.125 0C5.97012 0 3.90349 0.856024 2.37976 2.37976C0.856024 3.90349 0 5.97012 0 8.125C0 10.2799 0.856024 12.3465 2.37976 13.8702C3.90349 15.394 5.97012 16.25 8.125 16.25C9.86369 16.25 11.5449 15.6927 12.9299 14.677C12.9674 14.7281 13.0088 14.7763 13.0538 14.8212L17.8663 19.6337C18.1008 19.8681 18.4189 19.9997 18.7505 19.9996C19.0821 19.9995 19.4 19.8677 19.6344 19.6331C19.8688 19.3986 20.0004 19.0805 20.0003 18.7489C20.0002 18.4173 19.8683 18.0994 19.6338 17.865L14.8213 13.0525C14.7765 13.0077 14.7285 12.9664 14.6777 12.929Z"></path></svg></button>
          <input type="search" name="query" placeholder="Search" class="form-control border-start-0 border-dark-3 ps-1">
        </div>
      </form>
    </div>
  </div>
  <div class="d-none d-lg-block">
    <div class="container">
      <div class="row justify-content-between align-items-center">
        <div class="nav-desktop col-5">
        </div>
        <div class="col-5">
          <div class="row g-0 justify-content-end">
            <div class="col-lg-9 col-xl-7 col-xxl-6">
              <form action="" method="GET">
                <div class="input-group">
                  <button class="input-group-text border-end-0 border-dark-3 ps-4 pe-2"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-dark-3"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.7559 14.4767C9.92184 14.8222 9.02784 15 8.125 15C6.30164 15 4.55295 14.2757 3.26364 12.9864C1.97433 11.697 1.25 9.94836 1.25 8.125C1.25 6.30164 1.97433 4.55295 3.26364 3.26364C4.55295 1.97433 6.30164 1.25 8.125 1.25C9.02784 1.25 9.92184 1.42783 10.7559 1.77333C11.5901 2.11883 12.348 2.62524 12.9864 3.26364C13.6248 3.90204 14.1312 4.65994 14.4767 5.49405C14.8222 6.32817 15 7.22216 15 8.125C15 9.02784 14.8222 9.92184 14.4767 10.7559C14.1312 11.5901 13.6248 12.348 12.9864 12.9864C12.348 13.6248 11.5901 14.1312 10.7559 14.4767ZM14.6777 12.929C15.6929 11.5442 16.25 9.86333 16.25 8.125C16.25 5.97012 15.394 3.90349 13.8702 2.37976C12.3465 0.856024 10.2799 0 8.125 0C5.97012 0 3.90349 0.856024 2.37976 2.37976C0.856024 3.90349 0 5.97012 0 8.125C0 10.2799 0.856024 12.3465 2.37976 13.8702C3.90349 15.394 5.97012 16.25 8.125 16.25C9.86369 16.25 11.5449 15.6927 12.9299 14.677C12.9674 14.7281 13.0088 14.7763 13.0538 14.8212L17.8663 19.6337C18.1008 19.8681 18.4189 19.9997 18.7505 19.9996C19.0821 19.9995 19.4 19.8677 19.6344 19.6331C19.8688 19.3986 20.0004 19.0805 20.0003 18.7489C20.0002 18.4173 19.8683 18.0994 19.6338 17.865L14.8213 13.0525C14.7765 13.0077 14.7285 12.9664 14.6777 12.929Z"></path></svg></button>
                  <input type="search" name="query" placeholder="Search" class="form-control border-start-0 border-dark-3 ps-1">
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  const navMobile = nav.querySelector('.nav-mobile');
  const navDesktop = nav.querySelector('.nav-desktop');

  // load nav as fragment
  const navMeta = getMetadata('nav');

  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  const links = fragment.querySelectorAll('main li a')

  links.forEach((element) => {
    // mobile link
    const mobileLink = element.cloneNode(true);
    mobileLink.classList.add('fw-bold', 'text-dark-1', 'py-2', 'd-inline-block');

    const mobileLinkDiv = document.createElement('div');
    mobileLinkDiv.append(mobileLink);

    navMobile.append(mobileLinkDiv);

    // desktop link
    const desktopLink = element.cloneNode(true);
    console.log(element);
    desktopLink.classList.add('fw-bold', 'me-4', 'text-dark-1');

    navDesktop.append(desktopLink);
  });

  block.append(nav);

  /*
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
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
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

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
  */
}