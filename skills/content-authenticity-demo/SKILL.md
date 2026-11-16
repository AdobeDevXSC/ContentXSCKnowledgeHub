---
name: content-authenticity-demo
description: Build a standalone, single-file Content Authenticity (Content Credentials / C2PA) demo page that runs offline from a laptop with no server, AEM or CDN. Use when someone says "build a content authenticity demo", "make a Content Credentials demo page", "C2PA demo with my images", or wants a portable try-it-yourself page for a customer.
---

# Content Authenticity standalone demo

Produces one HTML file (about 13 MB) that the user double-clicks to open in a browser. It
embeds the Content Authenticity Initiative SDK (`@contentauth/c2pa-web` 0.17.0, including
its WebAssembly and worker) and two sample images. Visitors can inspect the samples' real
Content Credentials, drop in their own images, and download exact original bytes.

The working template is in `template/` next to this file. It already builds and passes its
tests with the default vineyard samples. Customize it; do not rewrite it.

## 1. Gather inputs (ask one question at a time)

1. **Output folder**: where to create the project (default: a new
   `content-authenticity-demo` folder in the current directory).
2. **Sample images**: two JPEGs. The first is the "original"; the second is the
   "modified" version (for example, edited in Adobe Express or Photoshop with Content
   Credentials turned on). Offer to keep the bundled vineyard samples.
   - Use the signed files themselves. Screenshots, re-exports, image-editor "Save for web",
     chat attachments, and some cloud previews strip credentials.
   - Each image should be well under 20 MB; the HTML grows by about 1.35x each image's size.
3. **Labels**: the dropdown and badge text for each sample (default: "Original vineyard
   image" / "Adobe Express–modified image"), and alt text describing each picture.
4. **Branding text** (optional): page `<title>`, header brand, eyebrow, headline, intro.
   Keep the "Provenance, not a promise of truth" aside and the network/trust disclaimers.

Never claim an image has, or was made with, specific credentials. The page reads and
reports what the SDK finds in the file.

## 2. Create the project

Copy everything in `template/` into the output folder. Requires Node.js 20+.

```sh
npm ci --ignore-scripts
```

## 3. Customize (exact locations)

Replace images by overwriting `sample.jpg` (original) and `express-sample.jpeg`
(modified). Keep those two file names; `build.mjs` and `test.mjs` read them. If either
sample is PNG, WebP or AVIF, also change its `type: 'image/jpeg'` in `viewer.js`.

| What | File | Where |
|---|---|---|
| Download file names | `viewer.js` | Lines 5–6: `'Brand-10-012.jpg'`, `'Adobe-Express-modified.jpeg'` |
| Initial file name shown | `page.html` | `<div id="filename" ...>Brand-10-012.jpg</div>` and the `aria-label` on `#download` |
| Dropdown options | `page.html` | `<option value="original">` and `<option value="express">` text (keep the `value`s) |
| Badge labels | `viewer.js` | `showImage()`: `'Original sample'`, `'Adobe Express-modified sample'` |
| Alt text | `viewer.js` and `page.html` | `showImage()` alt strings, and the `#preview` `alt` attribute |
| Download button labels | `viewer.js` | `showImage()`: `'Download original image'`, `'Download Adobe Express image'` |
| Attribution note | `page.html` | Step 1: "Adobe Express attribution is user-provided..." |
| Branding text | `page.html` | `<title>`, `.brand`, `.eyebrow`, `<h1>`, `.intro` |

When you change the download file names, update the matching assertions in `test.mjs`
(search for the old names). Leave the SDK version, `Context` options, and privacy defaults
unchanged unless the user asks.

## 4. Build and verify

```sh
npm run build
```

This writes `content-authenticity.html` and runs a syntax check on the bundled script.

Then run the browser tests. Prefer an installed Chrome:

```sh
# macOS
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
# or download Playwright's browser first
npx playwright install chromium && npm test
```

Tests open the built file from disk and check byte-exact downloads, offline reading, signed,
unsigned and tampered inputs, and the online-retrieval consent flow. Some tests download
small public fixtures from GitHub and fetch remote credential metadata, so they need
internet access. If a test fails only because of custom labels or file names, fix the
assertion; otherwise fix the page.

Finally, open `content-authenticity.html` in a browser and confirm:

- Each sample shows its expected result. Click **CR** to see the manifest.
- If a sample's credentials are stored in the cloud, a yellow **CR !** pin appears until step 3
  (allow online retrieval) is checked.

## 5. Hand off

Give the user the path to `content-authenticity.html` and tell them:

- That single file is the whole demo. Share it by file transfer or email (it is ~13 MB);
  no install is needed. It runs in current Chrome, Edge, Safari and Firefox.
- Embedded credentials work offline. Cloud-hosted credentials need internet and the
  in-page permission checkbox.
- "Valid" means the signature checks out; no external trust list is configured, so it does
  not mean the signer is trusted. Credentials record claims, not proof the scene is true.
- `template/README.md` (copied as `README.md`) documents details and limitations.
