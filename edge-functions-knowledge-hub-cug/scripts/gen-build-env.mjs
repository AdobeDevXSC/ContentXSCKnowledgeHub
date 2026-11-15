import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildKeys = new Set([
  'XSC_OKTA_ISSUER',
  'XSC_OKTA_CLIENT_ID',
  'XSC_OKTA_SCOPES',
  'XSC_OKTA_GROUPS_CLAIM',
]);
let contents = '';
try {
  contents = await readFile(resolve(root, '.env'), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const entries = {};
contents.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*(?:export\s+)?(XSC_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!match) return;
  const key = match[1];
  if (!buildKeys.has(key)) return;
  let value = match[2];
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) value = value.slice(1, -1);
  entries[key] = value;
});

const output = resolve(root, 'src/generated/build-env.js');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `export default ${JSON.stringify(entries)};\n`);
