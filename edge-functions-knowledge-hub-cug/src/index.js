/// <reference types="@fastly/js-compute" />

import { CacheOverride } from 'fastly:cache-override';
import { ConfigStore } from 'fastly:config-store';
import {
  callback, getSession, login, logout, me,
} from './okta.js';
import { describeAttribute, evaluatePolicy } from './abac.js';
import { SecretStoreManager } from './lib/config.js';
import { withPublicOrigin } from './lib/public-origin.js';
import { siteForRequest } from './sites.js';
import { homeDocumentAction, isHtmlDocumentNavigation } from './home-routing.js';
import { handleKv, isKvPath } from './kv.js';
import BUILD_ENV from './generated/build-env.js';

const CUG_REQUIRED_HEADER = 'x-aem-cug-required';
const CUG_GROUPS_HEADER = 'x-aem-cug-groups';
const CUG_LOGIN_PATH_HEADER = 'x-aem-cug-login-path';

let environmentPromise;

function configurationDiagnostic(phase, error) {
  const diagnostic = new Error();
  diagnostic.name = error?.name || 'Error';
  diagnostic.diagnosticPhase = phase;
  return diagnostic;
}

async function loadEnvironment() {
  let config;
  try {
    config = new ConfigStore('config_default');
  } catch {
    config = { get: () => null };
  }
  const get = (key) => {
    try {
      return config.get(key) || BUILD_ENV[key] || '';
    } catch (error) {
      throw configurationDiagnostic(`config:${key}`, error);
    }
  };
  const secret = async (key) => {
    try {
      return await SecretStoreManager.getSecret(key);
    } catch (error) {
      if (error?.name === 'MissingSecretError') return BUILD_ENV[key] || '';
      throw configurationDiagnostic(`secret:${key}`, error);
    }
  };
  const [
    oktaIssuerSecret,
    oktaClientIdSecret,
    oktaClientSecret,
    sessionSecret,
    siteToken,
    kvSecret,
  ] = await Promise.all([
    secret('XSC_OKTA_ISSUER'),
    secret('XSC_OKTA_CLIENT_ID'),
    secret('XSC_OKTA_CLIENT_SECRET'),
    secret('XSC_SESSION_SECRET'),
    secret('XSC_SITE_TOKEN'),
    secret('XSC_KV_SECRET'),
  ]);
  const env = {
    OKTA_ISSUER: oktaIssuerSecret || get('XSC_OKTA_ISSUER'),
    OKTA_CLIENT_ID: oktaClientIdSecret || get('XSC_OKTA_CLIENT_ID'),
    OKTA_CLIENT_SECRET: oktaClientSecret,
    OKTA_SCOPES: get('XSC_OKTA_SCOPES'),
    OKTA_GROUPS_CLAIM: get('XSC_OKTA_GROUPS_CLAIM'),
    OKTA_LOCAL_LOGOUT: true,
    SESSION_SECRET: sessionSecret,
    SITE_TOKEN: siteToken,
    KV_SECRET: kvSecret,
    KV_URL: get('XSC_KV_URL'),
  };
  const missing = [
    ['XSC_OKTA_ISSUER', env.OKTA_ISSUER],
    ['XSC_OKTA_CLIENT_ID', env.OKTA_CLIENT_ID],
    ['XSC_OKTA_CLIENT_SECRET', env.OKTA_CLIENT_SECRET],
    ['XSC_SESSION_SECRET', env.SESSION_SECRET],
    ['XSC_SITE_TOKEN', env.SITE_TOKEN],
  ].filter(([, value]) => !value).map(([key]) => key);
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) {
    missing.push('XSC_SESSION_SECRET (must be at least 32 characters)');
  }
  return { env, missing };
}

function getEnvironment() {
  if (!environmentPromise) environmentPromise = loadEnvironment();
  return environmentPromise;
}

const noStore = { 'cache-control': 'private, no-store' };

function loginRedirect(url, loginPath) {
  const returnTo = `${url.pathname}${url.search}`;
  const path = loginPath && loginPath.startsWith('/') ? loginPath : '/auth/login';
  const location = loginPath && /^https?:\/\//i.test(loginPath)
    ? loginPath
    : `${path}${path.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
  return new Response(null, {
    status: 302,
    headers: { ...noStore, location },
  });
}

function accessDenied(missing) {
  const requirements = missing.map(describeAttribute).join(', ');
  return new Response(
    requirements ? `Access denied. Required: ${requirements}` : 'Access denied.',
    { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8', ...noStore } },
  );
}

async function handleAuthRoute(request, env, url) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { allow: 'GET', ...noStore },
    });
  }
  switch (url.pathname) {
    case '/auth/login': return login(request, env);
    case '/auth/callback': return callback(request, env);
    case '/auth/logout': return logout(request, env);
    case '/auth/me': return me(request, env);
    default: return new Response('Not Found', { status: 404, headers: noStore });
  }
}

async function proxyWithCug(request, env, site, url) {
  let session;
  let publicHome = false;
  if (isHtmlDocumentNavigation(request, url)) {
    session = await getSession(request, env);
    const action = homeDocumentAction(request, url, session);
    if (action?.type === 'redirect') {
      return new Response(null, {
        status: 302,
        headers: { ...noStore, location: action.location },
      });
    }
    publicHome = action?.type === 'public';
  }

  const originUrl = `https://${site.ORIGIN_HOSTNAME}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('host');
  headers.delete('authorization');
  headers.set('authorization', `token ${env.SITE_TOKEN}`);
  headers.set('x-forwarded-host', site.host);

  const originResponse = await fetch(originUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    cacheOverride: new CacheOverride('pass'),
  });
  const responseHeaders = new Headers(originResponse.headers);
  const cugRequired = responseHeaders.get(CUG_REQUIRED_HEADER)?.toLowerCase() === 'true';
  const policy = responseHeaders.get(CUG_GROUPS_HEADER) || '';
  const loginPath = responseHeaders.get(CUG_LOGIN_PATH_HEADER);
  responseHeaders.delete(CUG_REQUIRED_HEADER);
  responseHeaders.delete(CUG_GROUPS_HEADER);
  responseHeaders.delete(CUG_LOGIN_PATH_HEADER);
  responseHeaders.delete('age');

  if (cugRequired && !publicHome) {
    session ??= await getSession(request, env);
    if (!session) {
      const isNavigation = request.method === 'GET'
        && (request.headers.get('accept') || '').includes('text/html');
      if (isNavigation) return loginRedirect(url, loginPath);
      return new Response('Unauthorized', { status: 401, headers: noStore });
    }
    const decision = evaluatePolicy(session, policy);
    if (!decision.allowed) return accessDenied(decision.missing);
  }

  responseHeaders.set('cache-control', 'private, no-store');
  return new Response(originResponse.body, {
    status: originResponse.status,
    headers: responseHeaders,
  });
}

export async function handleRequest(request) {
  const url = new URL(request.url);
  const site = siteForRequest(request, url);
  if (!site) return new Response('Not Found', { status: 404, headers: noStore });

  let failurePhase = 'configuration';
  try {
    const { env, missing } = await getEnvironment();
    if (missing.length) {
      return new Response(`Edge Function configuration is incomplete: ${missing.join(', ')}`, {
        status: 503,
        headers: noStore,
      });
    }
    failurePhase = 'request handling';
    if (url.pathname.startsWith('/auth/')) {
      return handleAuthRoute(request, withPublicOrigin(env, site), url);
    }
    if (isKvPath(url.pathname)) {
      const session = await getSession(request, env);
      return await handleKv(request, withPublicOrigin(env, site), url, session, {
        fetch: (input, init) => fetch(input, { ...init, cacheOverride: new CacheOverride('pass') }),
      });
    }
    return await proxyWithCug(request, env, site, url);
  } catch (error) {
    const errorType = error?.name || 'Error';
    const errorPhase = error?.diagnosticPhase || failurePhase;
    console.error(`Knowledge Hub CUG request failed during ${errorPhase} (${errorType})`);
    return new Response(`Edge Function error (${errorPhase}: ${errorType})`, {
      status: 503,
      headers: noStore,
    });
  }
}

addEventListener('fetch', (event) => event.respondWith(handleRequest(event.request)));
