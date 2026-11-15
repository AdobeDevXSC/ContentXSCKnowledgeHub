import assert from 'node:assert/strict';
import test from 'node:test';
// eslint-disable-next-line import/extensions
import { getAuthControl, isStageAuthHost } from '../blocks/header/auth.mjs';

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
