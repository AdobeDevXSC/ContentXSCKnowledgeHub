import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Script } from 'node:vm';

const root = path.dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [path.join(root, 'viewer.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'inline',
  write: false,
});
const packages = ['c2pa-web', 'c2pa-wasm', 'c2pa-types', 'c2pa-utilities'];
const notices = await Promise.all(packages.map(async (name) => (
  `@contentauth/${name}\n${await readFile(path.join(root, 'node_modules', '@contentauth', name, 'LICENSE'), 'utf8')}`
)));
notices.push(`highgain 0.1.0 — ISC License
Copyright (c) Eli Mensch
Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`);
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const template = await readFile(path.join(root, 'page.html'), 'utf8');
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
new Script(script);
const sampleBase64 = (await readFile(path.join(root, 'sample.jpg'))).toString('base64');
const expressBase64 = (await readFile(path.join(root, 'express-sample.jpeg'))).toString('base64');
const html = template
  .replace('@@SAMPLE@@', () => sampleBase64)
  .replace('@@EXPRESS@@', () => expressBase64)
  .replace('@@NOTICES@@', () => escape(notices.join('\n\n')))
  .replace('@@SCRIPT@@', () => script);
await writeFile(path.join(root, 'content-authenticity.html'), html);
console.log(`Built content-authenticity.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`);
