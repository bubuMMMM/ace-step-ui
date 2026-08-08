/**
 * Screenshots each landing page and writes the library thumbnails.
 *   node tools/thumbs.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'public', 'assets', 'img', 'thumbs');
const base = process.argv[2] || 'http://localhost:4173';

const PAGES = [
  { slug: 'kage', path: '/sites/kage/index.html', wait: 15000 },
  { slug: 'halo', path: '/sites/halo/index.html', wait: 4500 },
  { slug: 'atelier-noir', path: '/sites/atelier-noir/index.html', wait: 4000 },
  { slug: 'signal-lost', path: '/sites/signal-lost/index.html', wait: 4500 },
  { slug: 'meridian', path: '/sites/meridian/index.html', wait: 4000 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
await mkdir(outDir, { recursive: true });

for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(base + p.path, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(p.wait);
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  const dataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 880; c.height = 550;
    const x = c.getContext('2d');
    const sh = img.width * (550 / 880);
    x.drawImage(img, 0, 0, img.width, Math.min(sh, img.height), 0, 0, 880, 550);
    return c.toDataURL('image/webp', 0.78);
  }, png);
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(join(outDir, `${p.slug}.webp`), buf);
  console.log(`${p.slug}.webp  ${(buf.length / 1024).toFixed(1)} KB`);
  await page.close();
}
await browser.close();
