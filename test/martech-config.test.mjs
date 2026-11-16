import assert from 'node:assert/strict';
import test from 'node:test';
import { getBlockAnalyticsVars, getLinkType, isAnalyticsEnabled } from '../scripts/martech-config.mjs'; // eslint-disable-line import/extensions

test('sends analytics from production and stage hosts only', () => {
  assert.equal(isAnalyticsEnabled('xscknowledgehub.adobe.com'), true);
  assert.equal(isAnalyticsEnabled('stage.xscknowledgehub.adobe.com'), true);
  assert.equal(isAnalyticsEnabled('stage--contentxscknowledgehub--adobedevxsc.aem.live'), true);
  assert.equal(isAnalyticsEnabled('main--contentxscknowledgehub--adobedevxsc.aem.page'), false);
  assert.equal(isAnalyticsEnabled('xscknowledgehub.adobe.com', ''), false);
});

test('classifies clicked links as download, exit, or other', () => {
  const host = 'stage.xscknowledgehub.adobe.com';
  assert.equal(getLinkType('/files/guide.pdf', host), 'download');
  assert.equal(getLinkType('https://adobe.sharepoint.com/x', host), 'exit');
  assert.equal(getLinkType('/xsc-resources/page', host), 'other');
  assert.equal(getLinkType('mailto:a@adobe.com', host), 'other');
});

test('maps block events to the guide\'s Analytics events, eVars and props', () => {
  const block = {
    name: 'cards', position: 2, variant: 'featured', sequence: 3,
  };
  assert.deepEqual(getBlockAnalyticsVars({ event: 'block-impression', block }), {
    eVar10: 'cards', prop10: '2', eVar11: 'featured', prop11: '3', events: 'event10',
  });
  assert.deepEqual(getBlockAnalyticsVars({ event: 'block-click', block: { name: 'hero', position: 1 }, interaction: { label: 'Read more' } }), {
    eVar10: 'hero', prop10: '1', events: 'event11', eVar12: 'Read more',
  });
});
