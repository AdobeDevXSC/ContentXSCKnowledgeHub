import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymousHomepage } from '../src/anonymous-home.js';

const request = (method = 'GET', headers = {}) => new Request('https://stage.xscknowledgehub.adobe.com/', {
  method,
  headers,
});

test('serves an anonymous root document with an Okta sign-in link', async () => {
  const response = anonymousHomepage(
    request('GET', { accept: 'text/html' }),
    new URL('https://stage.xscknowledgehub.adobe.com/'),
    null,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(await response.text(), /href="\/auth\/login\?returnTo=%2F">Sign in<\/a>/);
});

test('does not replace the protected page for an authenticated root request', () => {
  const response = anonymousHomepage(
    request('GET', { accept: 'text/html' }),
    new URL('https://stage.xscknowledgehub.adobe.com/'),
    { sub: 'signed-in-user' },
  );

  assert.equal(response, null);
});

test('does not serve the anonymous page for other paths or non-document requests', () => {
  const cases = [
    [request('GET', { accept: 'text/html' }), 'https://stage.xscknowledgehub.adobe.com/docs/'],
    [request('GET', { accept: 'application/json' }), 'https://stage.xscknowledgehub.adobe.com/'],
    [request('HEAD', { accept: 'text/html' }), 'https://stage.xscknowledgehub.adobe.com/'],
    [
      request('GET', { accept: 'text/html', 'sec-fetch-dest': 'iframe' }),
      'https://stage.xscknowledgehub.adobe.com/',
    ],
  ];

  cases.forEach(([req, url]) => {
    assert.equal(anonymousHomepage(req, new URL(url), null), null);
  });
});
