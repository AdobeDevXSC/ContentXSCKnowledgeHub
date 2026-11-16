import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'portable-cai-test-'));
const revision = '57e2387ed6e1003eeb6129cc6877c0b9c7764328';
const source = `https://raw.githubusercontent.com/contentauth/c2pa-js/${revision}/packages`;
const fixtures = {};
for (const [name, location] of Object.entries({
  signed: 'c2pa-wasm/tests/fixtures/C.jpg',
  cloud: 'c2pa-node/tests/fixtures/cloud.jpg',
})) {
  const response = await fetch(`${source}/${location}`);
  assert.equal(response.status, 200);
  fixtures[name] = Buffer.from(await response.arrayBuffer());
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
try {
  const context = await browser.newContext({ acceptDownloads: true, offline: true });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  context.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root, 'content-authenticity.html')).href);
  const waitRead = async (target = page) => {
    await target.waitForFunction(() => !document.getElementById('retry').disabled && !document.getElementById('retry').hidden && !/Checking|Reading/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  };
  await waitRead();
  assert.deepEqual(await page.locator('.step h2').allTextContents(), ['Choose your starting image', 'Try your own image (AI or otherwise)', 'Demo step: allow online retrieval']);
  assert.equal(await page.locator('.step').nth(1).locator(':scope > p').innerText(), 'Add your normal image or an AI manipulated image.');
  assert.equal(await page.locator('#apply, #apply-dialog, iframe').count(), 0);
  assert.match(await page.locator('.step').nth(2).innerText(), /demo's privacy control, not a Content Credentials requirement/);
  assert.equal(await page.locator('#remote').isChecked(), false);
  assert.match(await page.locator('#status').innerText(), /No embedded Content Credentials/);
  assert.equal(await page.locator('#cr').isVisible(), false, 'unsigned input must not imply credentials');
  assert.equal(await page.locator('#preview').evaluate((image) => image.naturalWidth), 2000);
  const sample = await readFile(path.join(root, 'sample.jpg'));
  const downloadBytes = async () => {
    assert.match(await page.locator('#download').getAttribute('aria-label'), /Download.*image:/);
    assert.equal(await page.locator('#download').evaluate((button) => button.classList.contains('primary')), false);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#download').click();
    const download = await downloadEvent;
    return readFile(await download.path());
  };
  assert.equal(hash(await downloadBytes()), hash(sample), 'original download preserves exact bytes');
  console.log('PASS: file:// startup, offline SDK/worker/WASM, unsigned sample, byte-exact download');
  await page.locator('#sample-choice').selectOption('express');
  await waitRead();
  assert.equal(await page.locator('#filename').innerText(), 'Adobe-Express-modified.jpeg');
  assert.equal(hash(await downloadBytes()), hash(await readFile(path.join(root, 'express-sample.jpeg'))));
  assert.ok(await page.locator('#preview').evaluate((image) => image.naturalWidth > 0));
  console.log('Adobe Express sample:', await page.locator('#status').innerText());
  assert.equal(await page.locator('#cr').isVisible(), true, 'remote pointer must have a discoverable pending CR pin');
  assert.equal(await page.locator('#cr').getAttribute('data-state'), 'pending');
  assert.match(await page.locator('#remote-status').innerText(), /Demo action required/);
  await page.locator('#cr').click();
  assert.match(await page.locator('#credential-details').innerText(), /No manifest validation result/);
  assert.equal(await page.locator('#remote').isChecked(), false);
  assert.equal(requests.length, 0, 'opening pending CR must not enable remote retrieval');
  await page.keyboard.press('Escape');
  if (process.env.SCREENSHOT_PATH) {
    await page.setViewportSize({ width: 1365, height: 1050 });
    await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace('.png', '-express.png'), fullPage: true });
  }
  await page.locator('#sample-choice').selectOption('original');
  await waitRead();
  console.log('PASS: second embedded Adobe Express sample, preview and byte-exact download');
  await page.locator('#file').setInputFiles({ name: 'downloaded_from_aem.jpeg', mimeType: 'image/jpeg', buffer: await readFile(path.join(root, 'express-sample.jpeg')) });
  await waitRead();
  assert.equal(await page.locator('#filename').innerText(), 'downloaded_from_aem.jpeg');
  assert.equal(await page.locator('#cr').getAttribute('data-state'), 'pending');
  assert.equal(await page.locator('#cr').isVisible(), true);
  await page.locator('#cr').click();
  assert.match(await page.locator('#credential-details').innerText(), /not a validated signature/);
  assert.equal(await page.locator('#remote').isChecked(), false);
  assert.equal(requests.length, 0);
  await page.keyboard.press('Escape');
  console.log('PASS: imported user-supplied AI image retains a pending CR affordance without networking');
  await page.locator('#file').setInputFiles({ name: 'signed.jpg', mimeType: 'image/jpeg', buffer: fixtures.signed });
  await waitRead();
  console.log('Signed fixture:', await page.locator('#status').innerText());
  assert.match(await page.locator('#status').innerText(), /Content Credentials found/);
  await page.locator('#cr').click();
  assert.equal(await page.locator('#details-dialog').evaluate((dialog) => dialog.open), true);
  const full = await page.locator('#credential-details > details').last().locator('pre').textContent();
  const data = JSON.parse(full);
  assert.ok(data.active_manifest);
  assert.ok(data.manifests[data.active_manifest].signature_info);
  assert.ok(['Valid', 'Trusted'].includes(data.validation_state), `unexpected validation state ${data.validation_state}`);
  assert.ok(data.validation_results?.activeManifest.success.some((result) => result.code === 'claimSignature.validated'));
  await page.keyboard.press('Escape');
  assert.equal(hash(await downloadBytes()), hash(fixtures.signed));
  console.log('PASS: real signed manifest, cryptographic signature validation, details, signed byte preservation');
  const tampered = Buffer.from(fixtures.signed);
  const sos = tampered.indexOf(Buffer.from([0xff, 0xda]));
  assert.ok(sos > 0);
  const entropy = sos + 2 + tampered.readUInt16BE(sos + 2);
  tampered[entropy + 80] ^= 1;
  await page.locator('#file').setInputFiles({ name: 'tampered.jpg', mimeType: 'image/jpeg', buffer: tampered });
  await waitRead();
  assert.match(await page.locator('#status').innerText(), /SDK validation: Invalid/);
  const tamperedStore = JSON.parse(await page.locator('#credential-details > details').last().locator('pre').textContent());
  assert.ok(tamperedStore.validation_results.activeManifest.failure.some((result) => /hash.*mismatch/i.test(result.code)));
  console.log('PASS: tampered credential-bearing image is not reported as valid');
  await page.locator('#file').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0]) });
  await waitRead();
  assert.match(await page.locator('#status').innerText(), /Could not parse or validate/);
  await page.locator('#file').setInputFiles({ name: 'cloud.jpg', mimeType: 'image/jpeg', buffer: fixtures.cloud });
  await waitRead();
  console.log('Remote-only offline:', await page.locator('#status').innerText());
  assert.match(await page.locator('#status').innerText(), /remote|Remote|Online retrieval/);
  assert.equal(requests.length, 0, `unexpected external requests: ${requests.join(', ')}`);
  await page.locator('#cr').click();
  await page.locator('#fetch-remote').click();
  await waitRead();
  console.log('Remote-only permission, offline:', await page.locator('#status').innerText());
  assert.match(await page.locator('#status').innerText(), /Remote credential retrieval failed/);
  assert.equal(await page.locator('#cr').getAttribute('data-state'), 'failed');
  assert.match(await page.locator('#credential-details').innerText(), /No manifest validation result/);
  await page.keyboard.press('Escape');
  await page.locator('#remote').uncheck();
  await waitRead();
  await page.locator('#reset').click();
  await waitRead();
  await page.locator('#file').setInputFiles({ name: 'not-an-image.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  assert.match(await page.locator('#status').innerText(), /Unsupported or invalid input/);
  assert.equal(await page.locator('#filename').innerText(), 'Brand-10-012.jpg');
  await page.locator('#file').setInputFiles({ name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) });
  assert.match(await page.locator('#status').innerText(), /non-empty/);
  const oversized = path.join(temp, 'large.jpg');
  await writeFile(oversized, Buffer.alloc(50 * 1024 * 1024 + 1));
  await page.locator('#file').setInputFiles(oversized);
  assert.match(await page.locator('#status').innerText(), /50 MB/);
  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'dropped.jpg', { type: 'image/jpeg' }));
    document.getElementById('drop').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, fixtures.signed.toString('base64'));
  await waitRead();
  assert.equal(await page.locator('#filename').innerText(), 'dropped.jpg');
  assert.match(await page.locator('#status').innerText(), /Content Credentials found/);
  console.log('PASS: remote retrieval permission/error, invalid/empty/oversize input, local drop');
  await page.locator('#reset').click();
  await waitRead();
  await page.locator('#sample-choice').selectOption('express');
  await waitRead();
  await page.locator('#cr').click();
  assert.equal(await page.locator('#details-dialog').evaluate((dialog) => dialog.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#details-dialog').evaluate((dialog) => dialog.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'cr');
  for (const width of [320, 390, 1365]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(await page.evaluate(() => {
      const info = document.querySelector('.image-information').getBoundingClientRect();
      const download = document.getElementById('download').getBoundingClientRect();
      return download.left >= info.right && download.right <= innerWidth && download.height >= 40;
    }), `compact download must remain beside the image information at ${width}px`);
  }
  await page.setViewportSize({ width: 1365, height: 1050 });
  await page.screenshot({ path: process.env.SCREENSHOT_PATH || path.join(temp, 'preview.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: simplified three-step flow, accessible consent/modal/focus return, responsive layout');

  // Online inspection fetches only credential metadata; no local image is uploaded.
  const online = await browser.newContext();
  const onlinePage = await online.newPage();
  const metadataRequests = [];
  online.on('request', (request) => {
    if (/^https?:/.test(request.url())) metadataRequests.push({ url: request.url(), method: request.method() });
  });
  await onlinePage.goto(pathToFileURL(path.join(root, 'content-authenticity.html')).href);
  await waitRead(onlinePage);
  await onlinePage.locator('#sample-choice').selectOption('express');
  await waitRead(onlinePage);
  assert.equal(metadataRequests.length, 0);
  await onlinePage.locator('#remote').check();
  await waitRead(onlinePage);
  const expressOnline = await onlinePage.locator('#status').innerText();
  console.log('Adobe Express online metadata:', expressOnline);
  assert.match(expressOnline, /Content Credentials found|Remote credential retrieval failed/);
  assert.ok(metadataRequests.every((request) => request.method === 'GET'), 'remote inspection must not upload image bytes');
  if (/Content Credentials found/.test(expressOnline)) {
    assert.equal(await onlinePage.locator('#cr').getAttribute('data-state'), 'manifest');
    assert.match(await onlinePage.locator('#credential-details').textContent(), /SDK validation/);
  }
  if (/Content Credentials found/.test(expressOnline) && process.env.SCREENSHOT_PATH) {
    await onlinePage.setViewportSize({ width: 1365, height: 1050 });
    await onlinePage.screenshot({ path: process.env.SCREENSHOT_PATH.replace('.png', '-express-credentials.png'), fullPage: true });
    await onlinePage.locator('#cr').click();
    await onlinePage.screenshot({ path: process.env.SCREENSHOT_PATH.replace('.png', '-credential-details.png'), fullPage: true });
    await onlinePage.keyboard.press('Escape');
  }
  await online.close();
  await context.close();
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
