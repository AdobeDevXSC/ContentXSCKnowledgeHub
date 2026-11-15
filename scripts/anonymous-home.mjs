// eslint-disable-next-line import/extensions
import { getAuthControl } from '../blocks/header/auth.mjs';

export const ANONYMOUS_HOME_PATH = '/home';

export const ANONYMOUS_HOME_DEFAULTS = {
  eyebrow: 'Central source of truth for every XSC',
  title: 'Welcome to the Knowledge Hub',
  subtitle: 'Sign in with your Adobe account to explore guides, sales plays, and resources curated for Experience Solutions Consultants.',
};

export const ACCESS_GROUP = 'GRP-XSCKNOWLEDGEHUB';
export const ACCESS_GROUP_SUBSCRIBE_URL = `https://iam.corp.adobe.com/groups/subscribe?groups=${ACCESS_GROUP}`;

export function isAnonymousHomePath(pathname) {
  return pathname === ANONYMOUS_HOME_PATH;
}

/**
 * Picks the hero copy from the authored document. An authored heading becomes
 * the title, the line before it the eyebrow and the line after it the subtitle;
 * without a heading the branded defaults are used.
 * @param {{tag: string, text: string}[]} lines authored lines in document order
 */
export function getAnonymousHomeContent(lines = []) {
  const authored = lines.filter((line) => line.text && line.text.trim());
  const titleIdx = authored.findIndex((line) => /^H[1-6]$/i.test(line.tag));
  if (titleIdx < 0) return { ...ANONYMOUS_HOME_DEFAULTS };
  return {
    eyebrow: authored[titleIdx - 1]?.text.trim() || ANONYMOUS_HOME_DEFAULTS.eyebrow,
    title: authored[titleIdx].text.trim(),
    subtitle: authored[titleIdx + 1]?.text.trim() || ANONYMOUS_HOME_DEFAULTS.subtitle,
  };
}

function buildSignUpDialog(doc) {
  const dialog = doc.createElement('dialog');
  dialog.className = 'anonymous-home-dialog';
  dialog.setAttribute('aria-labelledby', 'anonymous-home-dialog-title');
  dialog.innerHTML = `
    <form method="dialog" class="anonymous-home-dialog-close-form">
      <button type="submit" class="anonymous-home-dialog-close" aria-label="Close">&times;</button>
    </form>
    <h2 id="anonymous-home-dialog-title">Request access</h2>
    <p>Adobe employees can get access to the Knowledge Hub by subscribing to the
      <strong>${ACCESS_GROUP}</strong> group in the Adobe IAM Portal.</p>
    <p class="anonymous-home-dialog-note">The Adobe IAM Portal requires the GlobalProtect VPN or a
      Cloud Secure Edge–registered device. Once your subscription is approved, return here and sign in.</p>
    <p class="anonymous-home-dialog-actions">
      <a class="button anonymous-home-dialog-subscribe" href="${ACCESS_GROUP_SUBSCRIBE_URL}"
        target="_blank" rel="noopener noreferrer">Subscribe in the Adobe IAM Portal</a>
    </p>`;
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

/**
 * Replaces the /home document body with the branded sign-in hero.
 * @param {Element} main
 */
export function decorateAnonymousHome(main) {
  const doc = main.ownerDocument;
  const lines = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6, p')]
    .map((el) => ({ tag: el.tagName, text: el.textContent }));
  const { eyebrow, title, subtitle } = getAnonymousHomeContent(lines);
  const signIn = getAuthControl(false, '/');

  const section = doc.createElement('div');
  section.className = 'section anonymous-home-container';
  section.dataset.sectionStatus = 'loaded';

  const hero = doc.createElement('div');
  hero.className = 'hero homepage anonymous-home';
  hero.innerHTML = `
    <div class="hero-aurora" aria-hidden="true"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>
    <div class="hero-home">
      <p class="hero-home-eyebrow"><span class="hero-home-dot"></span></p>
      <h1 class="hero-home-title"></h1>
      <p class="hero-home-subtitle"></p>
      <p class="anonymous-home-actions">
        <a class="button anonymous-home-signin"></a>
        <button type="button" class="anonymous-home-signup" aria-haspopup="dialog">Sign up</button>
      </p>
    </div>`;
  hero.querySelector('.hero-home-eyebrow').append(eyebrow);
  const words = title.split(/\s+/);
  const grad = doc.createElement('span');
  grad.className = 'grad';
  grad.textContent = words.length > 2 ? words.slice(-2).join(' ') : title;
  const heading = hero.querySelector('.hero-home-title');
  if (words.length > 2) heading.append(`${words.slice(0, -2).join(' ')} `);
  heading.append(grad);
  hero.querySelector('.hero-home-subtitle').textContent = subtitle;
  const link = hero.querySelector('.anonymous-home-signin');
  link.href = signIn.href;
  link.textContent = signIn.label;

  section.append(hero, buildSignUpDialog(doc));
  main.replaceChildren(section);
  const dialog = section.querySelector('.anonymous-home-dialog');
  hero.querySelector('.anonymous-home-signup').addEventListener('click', () => dialog.showModal());
}
