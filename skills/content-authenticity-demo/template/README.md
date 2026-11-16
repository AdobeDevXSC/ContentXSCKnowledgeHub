# Portable Content Authenticity demo

**End users need only `content-authenticity.html`.** Download or copy that file,
then open it directly in a modern browser (`file://`). There is no server,
installation, AEM, Dynamic Media, CDN, or backend dependency. The approximately
13 MB file includes both user-provided JPEG samples, JavaScript, WebAssembly,
the SDK's inline Blob worker, and runtime license notices.

## Demo flow

1. Choose the original vineyard image or the Adobe Express-modified image.
   Download the selected image. Adobe Express attribution is user-provided;
   credentials are never inferred from the label.
2. **Try your own image (AI or otherwise).** Add your normal image or an AI
   manipulated image. Import or drop a JPEG, PNG, WebP, or AVIF (up to 50 MB).
3. **Demo step: allow online retrieval.** This local-file demo starts in
   local-only mode and asks permission before contacting credential hosts.
   Enable retrieval to load the sample's cloud-hosted credentials. This is the
   demo's privacy control, not a Content Credentials requirement or a
   technical restriction imposed by `file://`. Embedded credentials remain
   readable offline. Click **CR** to inspect actual SDK manifests, assertions,
   signatures, and validation results.

An SDK-detected remote manifest pointer also shows a yellow **CR !** pin.
It is explicitly pending, not validated. Its dialog explains the network
requirement and offers **Fetch remote credentials (online)**; simply opening
the pin never enables networking. Successful retrieval replaces the pending
information with real SDK results. Failed retrieval retains an explanatory
pin and explicit retry action. Unsigned images do not show a credentials pin.

Downloads preserve the exact original image bytes, including metadata.
Imported files are displayed as Blob URLs and passed directly to the SDK;
there is no canvas re-encoding. Screenshots, converted renditions, or image
editor re-exports may lose credentials. Import the signed image itself, not a ZIP.

## Network and validation limitations

- Embedded manifests can be read and cryptographically validated offline.
  In this demo, remote-only credentials require its explicit retrieval consent,
  internet, and the manifest host's CORS support. With that checkbox off,
  remote retrieval and OCSP fetches are disabled. No local image bytes are
  uploaded, even with online retrieval enabled; metadata requests do expose
  the user's IP address to the remote host.
- No external trust list is configured or fetched. The SDK's `Valid`,
  `Trusted`, and `Invalid` results are presented without conflating validity
  with trusted identity. Inspect the full validation results, including
  signature, timestamp, trust, and ingredient failures. A valid manifest
  does not prove the scene or every signed assertion is true.
- No credentials, disabled remote retrieval, parsing/validation errors,
  remote fetch errors, and invalid manifests have distinct statuses.
- The viewer needs JavaScript, WebAssembly, and Blob workers enabled. Browser
  or enterprise policies can prohibit these. Chrome `file://` is covered by
  the integration test; do not assume every locked-down browser supports it.

## Building

```sh
npm ci --ignore-scripts
npm run build
```

The build pins `@contentauth/c2pa-web` **0.17.0**, imports `createC2pa`,
`Reader`, and `Context` from `/inline`, bundles all imports as a classic inline
script, and uses `Reader.fromBlob(handle, type, blob, context)`,
`reader.manifestStore()`, and `reader.free()`. The SDK embeds the WASM and
worker itself; neither is served from another file.

```sh
# Use an installed Chrome, without downloading a test browser:
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
# Or install Playwright's test browser first:
npx playwright install chromium
npm test
```

Tests open the exact built HTML from disk in a real browser, exercise both
byte-exact downloads, signed and unsigned inputs, a tampered image, remote-only
credentials with networking disabled and enabled-but-offline, invalid/empty/
oversize inputs, drag-and-drop, modal focus/Escape behavior, responsive layout,
the simplified three-step flow, and explicit retrieval consent. Local-only
checks run offline and assert zero external requests before online opt-in.
Online tests fetch remote credential metadata, never image uploads.

Tests download legitimate signed fixtures from the MIT-licensed
[`contentauth/c2pa-js` repository](https://github.com/contentauth/c2pa-js/tree/57e2387ed6e1003eeb6129cc6877c0b9c7764328)
at revision `57e2387ed6e1003eeb6129cc6877c0b9c7764328` into memory:
`packages/c2pa-wasm/tests/fixtures/C.jpg` and
`packages/c2pa-node/tests/fixtures/cloud.jpg`. Test credentials are not
production identity endorsements. Fixtures are not shipped as demo samples.
Set `SCREENSHOT_PATH` to retain original and Adobe Express preview screenshots.
