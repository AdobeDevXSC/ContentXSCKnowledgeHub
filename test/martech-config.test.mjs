import assert from 'node:assert/strict';
import test from 'node:test';
import { getLinkType, isAnalyticsEnabled } from '../scripts/martech-config.mjs'; // eslint-disable-line import/extensions

test('keeps analytics off until the org and datastream IDs are set', () => {
  assert.equal(isAnalyticsEnabled('stage.xscknowledgehub.adobe.com'), false);
  assert.equal(isAnalyticsEnabled('stage.xscknowledgehub.adobe.com', 'ORG@AdobeOrg'), false);
});

test('classifies clicked links as download, exit, or other', () => {
  const host = 'stage.xscknowledgehub.adobe.com';
  assert.equal(getLinkType('/files/guide.pdf', host), 'download');
  assert.equal(getLinkType('https://adobe.sharepoint.com/x', host), 'exit');
  assert.equal(getLinkType('/xsc-resources/page', host), 'other');
  assert.equal(getLinkType('mailto:a@adobe.com', host), 'other');
});
