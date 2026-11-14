import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIGIN_HOSTNAME, PUBLIC_HOST, PUBLIC_ORIGIN, siteForRequest,
} from '../src/sites.js';

const request = (headers = {}) => ({ headers: new Headers(headers) });

test('matches only the Stage Knowledge Hub hostname', () => {
  const site = siteForRequest(
    request({ host: PUBLIC_HOST }),
    new URL('https://internal.example/'),
  );
  assert.deepEqual(site, { host: PUBLIC_HOST, PUBLIC_ORIGIN, ORIGIN_HOSTNAME });
});

test('prefers the forwarded public host and normalizes case and port', () => {
  const site = siteForRequest(
    request({ 'x-forwarded-host': 'STAGE.XSCKNOWLEDGEHUB.ADOBE.COM:443' }),
    new URL('https://internal.example/'),
  );
  assert.equal(site.host, PUBLIC_HOST);
});

test('does not match the production host, EDS origin, or lookalike domains', () => {
  [
    'xscknowledgehub.adobe.com',
    'stage--contentxscknowledgehub--adobedevxsc.aem.live',
    'stage.xscknowledgehub.adobe.com.evil.example',
  ].forEach((host) => {
    assert.equal(
      siteForRequest(request({ host }), new URL(`https://${host}/`)),
      null,
    );
  });
});
