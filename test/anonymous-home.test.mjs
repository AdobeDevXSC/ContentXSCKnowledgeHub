import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANONYMOUS_HOME_DEFAULTS, getAnonymousHomeContent, getSignUpSection, isAnonymousHomePath,
// eslint-disable-next-line import/extensions
} from '../scripts/anonymous-home.mjs';

test('applies the signed-out landing only to /home', () => {
  assert.equal(isAnonymousHomePath('/home'), true);
  assert.equal(isAnonymousHomePath('/'), false);
  assert.equal(isAnonymousHomePath('/home/other'), false);
});

test('uses branded defaults when the document has no heading', () => {
  assert.deepEqual(getAnonymousHomeContent([{ tag: 'P', text: 'home' }]), ANONYMOUS_HOME_DEFAULTS);
});

test('uses authored eyebrow, heading, and subtitle when present', () => {
  assert.deepEqual(getAnonymousHomeContent([
    { tag: 'P', text: 'Eyebrow' },
    { tag: 'H1', text: 'Authored title' },
    { tag: 'P', text: 'Authored subtitle' },
  ]), { eyebrow: 'Eyebrow', title: 'Authored title', subtitle: 'Authored subtitle' });
});

test('uses the second document section as the sign-up modal when authored', () => {
  const modal = { textContent: ' Request access ' };
  assert.equal(getSignUpSection([{ textContent: 'hero' }, modal]), modal);
  assert.equal(getSignUpSection([{ textContent: 'hero' }, { textContent: '  ' }]), null);
  assert.equal(getSignUpSection([{ textContent: 'hero' }]), null);
});
