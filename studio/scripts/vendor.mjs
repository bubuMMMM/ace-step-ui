/**
 * Copies the three.js runtime out of node_modules into the static output so the
 * deployed site serves it from its own origin with relative paths (no CDN).
 * This is the only build step: nothing is bundled, transpiled or minified.
 */
import { copyFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = join(root, 'node_modules', 'three', 'build');
const to = join(root, 'public', 'sites', 'kage', 'vendor');
const files = ['three.module.min.js', 'three.core.min.js'];

await mkdir(to, { recursive: true });

for (const f of files) {
  const src = join(from, f);
  try {
    await access(src);
  } catch {
    // Already vendored in the repo (e.g. running without an npm install).
    await access(join(to, f));
    console.log(`vendor: keeping committed ${f}`);
    continue;
  }
  await copyFile(src, join(to, f));
  console.log(`vendor: ${f}`);
}

console.log('vendor: done');
