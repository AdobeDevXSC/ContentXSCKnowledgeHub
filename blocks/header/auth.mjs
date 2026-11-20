// Kept independent of the DOM so the Stage-specific actions can be tested directly.
export const STAGE_AUTH_HOST = 'stage.xscknowledgehub.adobe.com';

export function isStageAuthHost(hostname) {
  return hostname === STAGE_AUTH_HOST;
}

export function getAuthControl(authenticated, returnTo = '/') {
  if (authenticated) return { label: 'Sign out', href: '/auth/logout' };

  const destination = returnTo.startsWith('/')
    && !returnTo.startsWith('//')
    && !returnTo.includes('\\') ? returnTo : '/';
  return {
    label: 'Sign in',
    href: `/auth/login?returnTo=${encodeURIComponent(destination)}`,
  };
}

export function getUserInitials(name = '', email = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.trim().slice(0, 2).toUpperCase() || '?';
}

// Add future user-menu entries here; they render in order above Sign out.
export const USER_MENU_ITEMS = [
  {
    label: 'SharePoint Home',
    href: 'https://adobe.sharepoint.com/:f:/r/sites/ContentXSCKnowledgeHub/Shared%20Documents/Knowledge%20Hub?d=wb15720705c804ea9843ba535c16c5968&csf=1&web=1&e=Dqd0RK',
    external: true,
  },
  {
    label: 'View Analytics',
    href: 'https://www5.an.adobe.com/spa/?linkId=a0e34657-0e80-4b8d-8cf8-b50a2227da4d&dpc=pnw',
    external: true,
  },
];

export function getUserMenuItems() {
  return [
    ...USER_MENU_ITEMS,
    { ...getAuthControl(true), variant: 'danger' },
  ];
}
