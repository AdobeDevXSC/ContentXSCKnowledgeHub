# Set up Adobe corporate Okta login for Edge Delivery Closed User Groups (CUG)

Instructions for a GitHub Copilot agent. You will put an AEM Edge Function in front of an
Edge Delivery Services (EDS) site so that protected pages require sign-in through
**Adobe's corporate Okta** (`https://adobe.okta.com`), with access rules taken from the site's
`closed-user-groups` sheet.

This was first built for `xsc-demo.ynaka-adobe.com` (Cloud Manager program p154856). You are
doing it again on a **different IMS org / Cloud Manager program**. Copy the working
implementation; don't rewrite it.

## Reference implementation

- Edge Function source: GitHub `ynaka-adobe/AEM-p154856`, folder `edge-functions-xsc-demo/`
  (function name `xsc-demo-cug`). Read its `README.md` first.
  - `src/index.js`: request handling, `loadEnv()` (config/secret keys), CUG header enforcement.
  - `src/okta.js`: OIDC Authorization Code + PKCE login, callback, ID token validation (JWKS),
    `/userinfo` fallback for groups/country, logout.
  - `src/sites.js`: per-host settings. `useDefaultSiteOkta()` lets the default site use its own
    Okta app (`XSC_DEMO_OKTA_*`) and makes logout local-only.
  - `src/abac.js`: evaluates the `Groups` column of `closed-user-groups`.
  - `scripts/gen-build-env.mjs`: bakes `XSC_*` values from a gitignored `.env` into the build
    (needed on sandbox programs, which have no config/secret stores).
- CDN routing: `config-eds/cdn.yaml`, rule `route-xsc-demo-cug`.
- Store declarations: `config-eds/edgeFunctions.yaml`.
- Page Access authoring tool on the EDS site: `tools/cug/` in `ynaka-adobe/xsc-demo`.

If you can't read those repos, ask the user for access or a copy before starting.

## Inputs to collect from the user (ask one at a time)

1. Public site hostname, e.g. `demo.example.com` (call it `<HOST>`). It must already be a custom
   domain on the Cloud Manager program's Edge Delivery CDN.
2. EDS origin, e.g. `main--<repo>--<owner>.aem.live`.
3. Cloud Manager program ID and IMS org ID for the new org, and whether the program is a
   **sandbox** or **production**.
4. Which AD group(s) may sign in, and which groups/countries the CUG rules need.

Never ask the user to paste secrets into chat. Have them put secrets into a gitignored `.env`,
and read only key names, or values with secrets redacted.

## Step 1: Register the app in Adobe Okta (the user does this)

Adobe's Okta has no admin UI for employees. Apps are managed in **Corporate Authentication
Self Service** (My Applications / Register New Application). The registration lives in Adobe's
workforce Okta, so it doesn't matter which IMS org the AEM program is in.

Have the user register (or edit) an app with:

| Field | Value |
|---|---|
| OIDC Application Type | Web Application |
| Redirect URI (Initiate login URI) | `https://<HOST>/auth/callback`, exactly as written |
| Other Sign-in redirect URIs | optional: `http://127.0.0.1:7676/auth/callback` for local testing |
| Environment | Production (issuer `https://adobe.okta.com`) |
| Application Access (AD group) | the group(s) allowed to sign in. Users outside it are rejected by Okta |
| Custom Claims | `groups:<AD group 1>,<AD group 2>` if CUG rules check groups. Add a country claim if rules use country |

Then the user puts the **client ID** and **client secret** in a gitignored `.env`.

Endpoints by environment (pick the one the app was registered in):

| Env | Issuer |
|---|---|
| Production | `https://adobe.okta.com` |
| Preview | `https://adobe.oktapreview.com` |
| Stage | `https://adobe-stage.okta.com` |

### Verify the registration before writing any code

This probe needs no secret. Okta returns an HTML error page naming the bad parameter.

```bash
CID=<client id>; R=$(python3 -c "import urllib.parse;print(urllib.parse.quote('https://<HOST>/auth/callback',safe=''))")
curl -s -o /tmp/b "https://adobe.okta.com/oauth2/v1/authorize?client_id=$CID&response_type=code&scope=openid%20profile%20email%20groups%20address&redirect_uri=$R&state=x&nonce=y"
grep -q "redirect_uri&#39; parameter must" /tmp/b && echo "REDIRECT REJECTED" || echo "OK"
```

- If the redirect is rejected, the registered URI is wrong. Probe a few variants (a typo in the
  hostname, `/auth` instead of `/auth/callback`, a trailing slash) to find what Okta actually
  has, and tell the user the exact value to fix it to. In the first rollout, the user's
  registered hostname had a typo (`ynak-adobe` instead of `ynaka-adobe`), and that took several
  rounds to catch.
- If all three tenants (prod, preview, stage) reject the request, the client ID isn't registered
  in that tenant.
- Self-service edits can take a minute or so to apply. Some (custom claims) need an Okta admin
  and take longer.

## Step 2: Edge Function code

1. Copy `edge-functions-xsc-demo/` into the new program's repo, e.g. as `edge-functions-<site>-cug/`.
   Rename the function (`fastly.toml` name, deploy target) to `<site>-cug`.
2. Update the hard-coded defaults in `src/index.js` (`DEFAULT_ORIGIN`, `DEFAULT_PUBLIC_ORIGIN`,
   `DEFAULT_OKTA_ISSUER`, `DEFAULT_OKTA_CLIENT_ID`, `DEFAULT_CODES_URL`) and `DEFAULT_HOST` /
   `WILDCARD` / `SITES` in `src/sites.js` for the new host. Delete site entries that don't apply
   (the `fmc-dealer-communications` and `dealer-communications` entries are specific to the
   original program).
3. Adobe Okta specifics. These are already handled in the reference code; keep them:
   - **Logout must be local.** Adobe's self-service form has no sign-out redirect URI field, so
     Okta's `/logout` with `post_logout_redirect_uri` fails. The reference sets
     `env.OKTA_LOCAL_LOGOUT = true` when the `XSC_DEMO_OKTA_*` keys are used, and `logout()` then
     just clears the cookies and redirects to `/`. If you instead point the plain
     `XSC_OKTA_ISSUER` / `XSC_OKTA_CLIENT_ID` at Adobe Okta, set `OKTA_LOCAL_LOGOUT` there too.
     The user stays signed in to Adobe SSO, so "sign in" afterwards is instant. That's expected.
   - **Groups and country are usually missing.** Adobe Okta sends no `groups` (and often no
     country) unless an Okta admin adds the custom claims. The code already falls back to
     `/userinfo`. Until the claims exist, write CUG rules with `logged-in` / `employees` or
     `company:adobe` (company falls back to the email domain).
   - Scopes `openid profile email groups address` are accepted by the Adobe org authorization
     server. Leave `XSC_OKTA_SCOPES` unset.
4. Run `npm install && npm test` (Node test runner) and keep the tests passing. Update the
   tests that reference removed hosts.

## Step 3: Configuration and secrets

Keys are prefixed `XSC_` in the reference. Choose a new prefix only if the program's shared
stores would collide. Keep the code and the config in sync if you rename them.

| Key | Kind | Value |
|---|---|---|
| `XSC_OKTA_ISSUER` | config | `https://adobe.okta.com` |
| `XSC_OKTA_CLIENT_ID` | config | Adobe Okta client ID |
| `XSC_OKTA_CLIENT_SECRET` | secret | Adobe Okta client secret |
| `XSC_SESSION_SECRET` | secret | `openssl rand -base64 48` |
| `XSC_SITE_TOKEN` | secret | only if aem.live site authentication is enabled on the EDS site |

(When one function serves several hosts and only one should use Adobe Okta, use
`XSC_DEMO_OKTA_ISSUER` / `XSC_DEMO_OKTA_CLIENT_ID` / `XSC_DEMO_OKTA_CLIENT_SECRET` for the
default host instead, as in the reference.)

- **Sandbox program:** no config or secret stores. Put the keys in
  `edge-functions-<site>-cug/.env` (gitignored; template `.env.example`). `npm run build` /
  `aio aem edge-functions build` embeds them via `scripts/gen-build-env.mjs`. Check
  `src/generated/build-env.js` lists the key **names** after the build. Keep every `.env` copy
  used for deploys in sync, or a later deploy silently reverts the config.
- **Production program:** declare the config keys and secrets in `config-eds/edgeFunctions.yaml`
  (secret values as `${{CM_VAR_NAME}}`). The user must create the Cloud Manager **secret**
  environment variables **before** the config pipeline runs. A missing secret fails the deploy
  for every site on that CDN.

## Step 4: CDN route

Add to `config-eds/cdn.yaml` under `originSelectors.rules`:

```yaml
      - name: route-<site>-cug
        when:
          allOf:
            - { reqProperty: domain, equals: "<HOST>" }
        action: { type: selectAemOrigin, originName: edgefunction-<site>-cug, skipCache: true }
```

Deploy the config through the Edge Delivery config pipeline for `/config-eds`.

## Step 4b: Deploy access in the new IMS org (Developer Console project)

The edge function runs on the AEM CDN, **not App Builder**. You don't need an App Builder
project, template, or product. The reference setup deploys with a regular Developer Console
project that has an OAuth Server-to-Server credential:

| Reference (org 332794) | Value |
|---|---|
| Project | **XSCDemo** (plain project, not the App Builder template), workspace *Production* |
| APIs on the credential | **AEM Content Delivery Network (CDN) API (beta)**, **Cloud Manager**, **Edge Delivery Services** |
| Resulting scopes | `openid`, `AdobeID`, `read_organizations`, `additional_info.projectedProductContext`, `read_pc.dma_aem_ams`, `aem.cdn`, `aem.frontend.all` |

Scopes come from the API cards, not the org. Adding the **same three APIs** in the new org gives
the same scopes. What's org-specific is the project, the client ID and secret, and the **product
profiles** attached to the credential. Never copy the reference `.aio`, client ID, or secret.

### 1. Grant the deploying user access (org admin, https://adminconsole.adobe.com)

| Site type | Product → profile |
|---|---|
| **Edge Delivery site with Adobe Managed CDN** (this setup) | **Cloud Manager → Deployment Manager** |
| AEM as a Cloud Service environment | **AEM <program/env> Author → AEM Administrators** |

The user also needs **Developer** access in Admin Console (or System Admin) to create a Developer
Console project in that org. Edge Functions must be enabled for the program (beta entitlement).

### 2. Create the Developer Console project (new org)

1. Go to https://developer.adobe.com/console and switch to the **new org** (top-right org picker).
2. **Create new project** → **Add to Project → API**. Don't use "Create project from template".
3. Add **AEM Content Delivery Network (CDN) API**, then choose **OAuth Server-to-Server**.
   - If the API isn't listed, the org isn't entitled to Edge Functions or AEM CDN yet. Ask
     Adobe to enable it, because this blocks deploys.
4. On the product-profile step, select the profile that gives **Deployment Manager** on the
   program (EDS) or **AEM Administrators** (AEMaaCS).
5. Add **Cloud Manager** and **Edge Delivery Services** APIs to the **same** credential
   (Add to Project → API → choose the existing OAuth Server-to-Server credential). For Cloud
   Manager, pick the same Deployment Manager profile.
6. Rename the project (e.g. `<Site>Demo`) and **Save**.
7. Download the project JSON (**Download all**) to a path **outside git**. It contains the
   client secret.

### 3. Point the CLI at the new org and project

```bash
cd edge-functions-<site>-cug
rm -f .aio                                    # never reuse another org's .aio
aio logout && aio login                       # sign in as a user in the NEW org
aio aem edge-functions setup -c /path/to/<project>.json
#   local .aio = yes; pick the new org, program, environment; Edge Delivery = yes;
#   site domain = <HOST>; store the client secret in .env
aio aem edge-functions info                   # must show the NEW org/program/project
aio aem edge-functions build
aio aem edge-functions deploy <site>-cug
```

`aio where` / `aio console` show the *console* context, which may point at an unrelated
project. The project used for deploys is the one in the edge-function folder's `.aio`, shown by
`aio aem edge-functions info`.

The function name `<site>-cug` must match the edge function declared in the program's
`config-eds` (origin `edgefunction-<site>-cug`). It can be at most 30 characters, using
lowercase letters, digits, and hyphens.

### Troubleshooting

- **API not offered in Developer Console:** no Edge Functions / AEM CDN entitlement in that org.
- **401/403 on deploy, or `invalid_client`:** the credential lacks the Deployment Manager
  profile, the secret is wrong or rotated, or the `.aio` is from another org. Fix the profile in
  Developer Console → credential → product profiles, or rerun `setup -c` with a fresh download.
- **Program/environment not listed in setup:** the user isn't in Cloud Manager for that org, or
  is signed into another org (`aio logout`, then `aio login`).
- **Function not found:** the `config-eds` pipeline that declares the edge function hasn't run in
  the new program yet.
- **CI (GitHub Actions):** set `AEM_EDGE_FUNCTIONS_ADC_CONFIG` (project JSON),
  `AEM_EDGE_FUNCTIONS_PROGRAM_ID`, and `AEM_EDGE_FUNCTIONS_ENVIRONMENT_ID` as secrets, then run
  `aio aem edge-functions info --batch`.

### Inventory of required `.env` / local config files

Nothing below is committed. Confirm `.env`, `.aio`, and `src/generated/` are in `.gitignore`
before writing secrets.

| File | Created by | Keys (names only) | Needed for |
|---|---|---|---|
| `edge-functions-<site>-cug/.aio` | `aio aem edge-functions setup` | `cloudmanager_orgid`, `cloudmanager_programid`, `edgefunctions_edge_delivery`, `edgefunctions_site_domain` `edgefunctions_adc_orgid` / `_projectid` / `_workspaceid` / `_client_id` / `_scopes` | deploy target + Developer Console project; regenerate per org |
| `edge-functions-<site>-cug/.env` | you + setup | see below | runtime values embedded at build (sandbox) + deploy secret |
| `edge-functions-<site>-cug/.env.example` | committed template | key names, empty values | onboarding |
| `<project>.json` (ADC download) | Developer Console | `ORG_ID`, `CLIENT_ID`, `CLIENT_SECRETS`, `SCOPES`, `TECHNICAL_ACCOUNT_*` | input to `setup -c`; keep outside the repo |
| `<eds-site-repo>/.env` (optional) | you | scratch copies, e.g. `ADOBE_OKTA_CLIENT_ID` / `ADOBE_OKTA_CLIENT_SECRET` | the user's own record only; the function never reads it |

Keys in `edge-functions-<site>-cug/.env`. Only `XSC_*` keys are embedded into the package by
`scripts/gen-build-env.mjs`.

| Key | Required? | Kind | Notes |
|---|---|---|---|
| `AEM_EDGE_FUNCTIONS_ADC_CLIENT_SECRET` | **yes** (deploy) | CLI secret | written by `setup -c`; not embedded |
| `XSC_OKTA_ISSUER` | **yes** | config | `https://adobe.okta.com` (code default is the reference's personal Okta) |
| `XSC_OKTA_CLIENT_ID` | **yes** | config | Adobe Okta client ID |
| `XSC_OKTA_CLIENT_SECRET` | **yes** | secret | Adobe Okta client secret |
| `XSC_SESSION_SECRET` | **yes** | secret | `openssl rand -base64 48` |
| `XSC_OKTA_LOCAL_LOGOUT` / code flag | **yes** for Adobe Okta | config | no sign-out URI in self-service; logout must be local |
| `XSC_ORIGIN_HOSTNAME` | yes, unless the code default is changed | config | `main--<repo>--<owner>.aem.live` |
| `XSC_PUBLIC_ORIGIN` | yes, unless the code default is changed | config | `https://<HOST>` |
| `XSC_SITE_TOKEN` | only if aem.live site auth is on | secret | EDS site token |
| `XSC_OKTA_GROUPS_CLAIM` / `_COUNTRY_CLAIM` / `_COMPANY_CLAIM` | optional | config | claim names, if the Okta admin named them differently |
| `XSC_OKTA_SCOPES` | optional | config | leave unset |
| `XSC_SESSION_TTL` | optional | config | seconds |
| `XSC_DEMO_OKTA_ISSUER` / `_CLIENT_ID` / `_CLIENT_SECRET` | only for a multi-site function | config/secret | per-host Adobe Okta override (reference pattern) |
| `XSC_DM_*`, `XSC_FMC_API_SECRET`, `XSC_DEALER_COMMUNICATIONS_API_SECRET`, `XSC_CODES_URL` | **no** | — | other demos in the reference; drop them |

If `XSC_OKTA_LOCAL_LOGOUT` doesn't exist as a config key in your copy (in the reference it's set
in code by `useDefaultSiteOkta`), either add it to `loadEnv` or set `env.OKTA_LOCAL_LOGOUT = true`
unconditionally.

After `aio aem edge-functions build`, run
`node -e "import('./src/generated/build-env.js').then(m=>console.log(Object.keys(m.default)))"`
to confirm the key **names**. Never print values.

## Step 5: Build and deploy the function

Requires the Step 4b Developer Console project and `.aio` pointed at the new org and program. Run
`aio aem edge-functions info` before deploying.

```bash
aio aem edge-functions build
aio aem edge-functions deploy <site>-cug
aio aem edge-functions tail-logs <site>-cug
```

Activation can take 1–2 minutes. Poll instead of assuming it's live.

## Step 6: Site (DA) setup

1. Create and publish a `closed-user-groups` sheet at the site root (columns `url | groups`).
   - Groups cell syntax (see `src/abac.js`): empty = any signed-in user; comma = AND; `|` = OR;
     `country:US`, `company:adobe`, `group:<name>`, `logged-in` / `employees`.
2. Add the Protected Pages plugin to the DA `prepare` config sheet
   (`https://main--aem-apps--adobe-rnd.aem.live/tools/plugins/cug/cug.html`), or copy
   `tools/cug/` from `ynaka-adobe/xsc-demo`, and apply page access. The `x-aem-cug-*` headers
   only appear after this step.

## Step 7: Verify

```bash
# login redirects to Adobe Okta with the right redirect_uri
curl -s -o /dev/null -w '%{redirect_url}\n' "https://<HOST>/auth/login?returnTo=/"
# Okta accepts that exact request (expect 200, no redirect_uri error)
L=$(curl -s -o /dev/null -w '%{redirect_url}' "https://<HOST>/auth/login?returnTo=/"); curl -s -o /tmp/b -w '%{http_code}\n' "$L"
# logout stays local (cookie name is cug_idt): expect https://<HOST>/
curl -s -o /dev/null -w '%{redirect_url}\n' -H 'cookie: cug_idt=dummy' "https://<HOST>/auth/logout"
# a protected page without a session: 302 to /auth/login
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'accept: text/html' "https://<HOST>/<protected-path>"
```

Then have the user sign in in a browser and open `https://<HOST>/auth/me`. Check `email`,
`groups`, `country` and `attributes`. Empty groups or country means the Okta custom claims
aren't in place yet (Step 1).

## Pitfalls seen in the first rollout

- Typo in the registered redirect hostname. Always run the probe in Step 1 against the exact
  `https://<HOST>/auth/callback`.
- Self-service saves can apply a different value than intended. Probe again after every edit.
- Okta `/logout` fails without a registered sign-out URI, so use local logout.
- No `groups` claim by default, so CUG rules that use groups deny everyone until an Okta admin
  adds the claim.
- Two copies of the build `.env` (main checkout and worktree): update both, or the next deploy
  reverts.
- Don't push or rewrite other people's unpushed commits in a shared checkout. Deploy from a
  clean worktree on `origin/main`.
- Sign-in only works for members of the app's **Application Access** AD group. External
  customers can't use Adobe Okta; keep a separate IdP or guest codes for them.
