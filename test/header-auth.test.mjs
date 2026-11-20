import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAuthControl, getUserInitials, getUserMenuItems, isStageAuthHost,
} from '../blocks/header/auth.mjs'; // eslint-disable-line import/extensions

test('enables auth controls only on the Stage public host', () => {
  assert.equal(isStageAuthHost('stage.xscknowledgehub.adobe.com'), true);
  assert.equal(isStageAuthHost('stage--contentxscknowledgehub--adobedevxsc.aem.live'), false);
  assert.equal(isStageAuthHost('xscknowledgehub.adobe.com'), false);
  assert.equal(isStageAuthHost('xsc-demo.ynaka-adobe.com'), false);
});

test('creates a sign-in link that returns to the current page', () => {
  const action = getAuthControl(false, '/docs/setup?view=full');
  assert.equal(action.label, 'Sign in');
  assert.equal(action.href, '/auth/login?returnTo=%2Fdocs%2Fsetup%3Fview%3Dfull');
});

test('does not use an external sign-in return destination', () => {
  ['https://example.com', '//example.com', '/\\example.com'].forEach((destination) => {
    const action = getAuthControl(false, destination);
    assert.equal(action.href, '/auth/login?returnTo=%2F');
  });
});

test('creates a sign-out link for authenticated users', () => {
  assert.deepEqual(getAuthControl(true), { label: 'Sign out', href: '/auth/logout' });
});

test('derives user initials from the name, then the email', () => {
  assert.equal(getUserInitials('Yuji Nakagawa', 'ynaka@adobe.com'), 'YN');
  assert.equal(getUserInitials('Ana Maria Lopez'), 'AL');
  assert.equal(getUserInitials('', 'ynaka@adobe.com'), 'YN');
  assert.equal(getUserInitials(), '?');
});

test('lists SharePoint Home as an external user-menu link', () => {
  const [first] = getUserMenuItems();
  assert.equal(first.label, 'SharePoint Home');
  assert.ok(first.href.startsWith('https://adobe.sharepoint.com/'));
  assert.equal(first.external, true);
});

test('lists View Analytics after SharePoint Home', () => {
  const [, second] = getUserMenuItems();
  assert.equal(second.label, 'View Analytics');
  assert.ok(second.href.startsWith('https://www5.an.adobe.com/'));
  assert.equal(second.external, true);
});

test('ends the user menu with Sign out', () => {
  const items = getUserMenuItems();
  assert.deepEqual(items.at(-1), { label: 'Sign out', href: '/auth/logout', variant: 'danger' });
});
