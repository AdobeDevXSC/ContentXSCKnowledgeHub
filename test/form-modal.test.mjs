import assert from 'node:assert/strict';
import test from 'node:test';
import { getFormEmbedUrl } from '../scripts/form-modal.mjs'; // eslint-disable-line import/extensions

test('builds embed URLs for Microsoft Forms links', () => {
  assert.equal(getFormEmbedUrl('https://forms.office.com/r/HGANSfKpHP'), 'https://forms.office.com/r/HGANSfKpHP?embed=true');
  assert.equal(
    getFormEmbedUrl('https://forms.office.com/Pages/ResponsePage.aspx?id=abc&route=shorturl'),
    'https://forms.office.com/Pages/ResponsePage.aspx?id=abc&route=shorturl&embed=true',
  );
});

test('ignores links that are not Microsoft Forms', () => {
  assert.equal(getFormEmbedUrl('https://adobe.sharepoint.com/sites/x'), null);
  assert.equal(getFormEmbedUrl('http://forms.office.com/r/x'), null);
  assert.equal(getFormEmbedUrl('/contact-us'), null);
});
