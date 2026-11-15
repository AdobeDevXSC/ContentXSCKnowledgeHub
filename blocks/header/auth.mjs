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
