import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeDocumentAction } from '../src/home-routing.js';

const request = (method = 'GET', headers = {}) => new Request('https://stage.xscknowledgehub.adobe.com/', {
  method,
  headers,
});

test('redirects an anonymous root document navigation to the public home document', () => {
  assert.deepEqual(
    homeDocumentAction(
      request('GET', { accept: 'text/html' }),
      new URL('https://stage.xscknowledgehub.adobe.com/'),
      null,
    ),
    { type: 'redirect', location: '/home' },
  );
});

test('allows anonymous home document navigation through CUG', () => {
  assert.deepEqual(
    homeDocumentAction(
      request('GET', { accept: 'text/html' }),
      new URL('https://stage.xscknowledgehub.adobe.com/home'),
      null,
    ),
    { type: 'public' },
  );
});

test('redirects authenticated home requests and leaves the authenticated root unchanged', () => {
  const signedIn = { sub: 'signed-in-user' };
  assert.deepEqual(
    homeDocumentAction(
      request('GET', { accept: 'text/html' }),
      new URL('https://stage.xscknowledgehub.adobe.com/home'),
      signedIn,
    ),
    { type: 'redirect', location: '/' },
  );
  assert.equal(
    homeDocumentAction(
      request('GET', { accept: 'text/html' }),
      new URL('https://stage.xscknowledgehub.adobe.com/'),
      signedIn,
    ),
    null,
  );
});

test('does not make other routes or non-document requests public', () => {
  const cases = [
    [request('GET', { accept: 'text/html' }), 'https://stage.xscknowledgehub.adobe.com/docs/'],
    [request('GET', { accept: 'application/json' }), 'https://stage.xscknowledgehub.adobe.com/home'],
    [request('HEAD', { accept: 'text/html' }), 'https://stage.xscknowledgehub.adobe.com/home'],
    [
      request('GET', { accept: 'text/html', 'sec-fetch-dest': 'iframe' }),
      'https://stage.xscknowledgehub.adobe.com/home',
    ],
  ];

  cases.forEach(([req, url]) => {
    assert.equal(homeDocumentAction(req, new URL(url), null), null);
  });
});
