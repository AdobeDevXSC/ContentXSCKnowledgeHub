# Knowledge Hub Stage CUG Edge Function

This package adapts the reference Okta CUG Edge Function for the Stage
environment only. Its package and function identifiers are Stage-specific and
must remain separate from any production Edge Function:

- Public host: `stage.xscknowledgehub.adobe.com`
- EDS origin: `stage--contentxscknowledgehub--adobedevxsc.aem.live`
- OIDC callback: `https://stage.xscknowledgehub.adobe.com/auth/callback`
- Okta issuer for the Stage app: `https://adobe-stage.okta.com`
- Okta application access is assigned to `GRP-XSCKNOWLEDGEHUB`.

The function proxies this host to the fixed Stage EDS origin, forwards the EDS
site token only to that origin, strips CUG response headers, and enforces the
existing `x-aem-cug-*` headers. The Okta application's access-group assignment
limits who can authenticate; page-level CUG policies continue to come from the
protected content.

An unauthenticated HTML navigation to the protected root (`/`) redirects to
`/home`, which is served from the public `home.docx` EDS document. The function
allows unauthenticated HTML navigations to that exact path through the CUG
check; a signed-in request to `/home` redirects to the normal `/` homepage.
All other protected paths continue through the existing CUG policy checks.
Author and publish `home.docx` through DA before relying on the public landing
page.

## Secure configuration

Set these values in Adobe's secure configuration stores. Do not commit the
values or paste secrets into chat.

`secret_default` (sourced from Cloud Manager secret variables by
`config-eds/edgeFunctions.yaml`):

- `XSC_OKTA_ISSUER` (use the Stage issuer above)
- `XSC_OKTA_CLIENT_ID`
- `XSC_OKTA_CLIENT_SECRET`
- `XSC_SESSION_SECRET` (at least 32 characters)
- `XSC_SITE_TOKEN` (the site-authentication token for the Stage EDS origin)
- `XSC_KV_SECRET` (optional; enables `/api/kv/*`, see below)

Optional `XSC_OKTA_SCOPES` and `XSC_OKTA_GROUPS_CLAIM` values can be added to
`config_default`.

The function fails closed with HTTP 503 when required configuration is missing.
Logout is local-only because the Adobe corporate self-service app does not
provide a sign-out redirect URI. App assignment restricts who can sign in; if
page CUG policies require group membership claims, configure the corresponding
Okta custom claim as well. The screenshot's app settings do not currently show
a groups custom claim.

For local builds, copy `.env.example` to `.env`; the build script embeds only
the non-secret issuer, client ID, scopes, and group-claim setting into an
ignored generated file. Client secrets, session secrets, and the site token are
never embedded and must be provided through Adobe's secure stores. Do not
commit `.env` or generated build output.

## Per-user metadata (`/api/kv/*`)

Requests to `/api/kv/*` are handled by the function, not the EDS origin. It
requires a signed-in Okta session and forwards the request to the App Builder
`per-user-metadata/kv` action (repository `ynaka-adobe/per-user-metadata`) as app
`knowledge-hub`. The caller is identified by the session email only, and each
request is HMAC-signed with `XSC_KV_SECRET`. Supported methods are `GET`, `PUT`
and `DELETE`. Cross-origin writes are rejected, as are bodies larger than 300 KB.

- `XSC_KV_SECRET` (`secret_default`) must equal the action's
  `KV_SECRET_KNOWLEDGE_HUB`. Without it, `/api/kv/*` returns 503 and the rest of
  the site is unaffected.
- `XSC_KV_URL` (optional, `config_default`) overrides the default Production
  action URL.

Examples: `GET /api/kv/favorites/user`, `PUT /api/kv/links/user/{key}` with a
JSON body, `PUT /api/kv/avatar/user/image` with an image body.

## Build and tests

```sh
npm install
npm test
npm run build
```

`config-eds/cdn.yaml` and `config-eds/edgeFunctions.yaml` are Stage-only
configuration. The CDN rule matches only `stage.xscknowledgehub.adobe.com`.
These files are not deployed by this change.
