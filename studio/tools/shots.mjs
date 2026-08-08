/**
 * Captures the composed frames of the Kage world with all page furniture
 * hidden, then writes them as WebP "cinematic stills" for the editorial
 * cards. The stills are renders of the same live scene the visitor walks
 * through — nothing is imported from outside the project.
 *
 *   node tools/shots.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'public', 'sites', 'kage', 'assets', 'img');
const base = process.argv[2] || 'http://localhost:4173';

/* section index → where inside that section's scroll range to stop */
const STILLS = [
  { name: 'still-threshold-01', section: 1, at: 0.08, ratio: 3 / 2 },
  { name: 'still-threshold-02', section: 1, at: 0.62, ratio: 3 / 2 },
  { name: 'still-ascent-01', section: 2, at: 0.18, ratio: 2 / 1 },
  { name: 'still-gardens-01', section: 3, at: 0.10, ratio: 3 / 2 },
  { name: 'still-gardens-02', section: 3, at: 0.55, ratio: 3 / 2 },
  { name: 'still-craft-01', section: 4, at: 0.10, ratio: 3 / 2 },
  { name: 'still-craft-02', section: 4, at: 0.58, ratio: 3 / 2 },
  { name: 'still-afterlight-01', section: 5, at: 0.30, ratio: 2 / 1 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`${base}/sites/kage/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(6000);

const anchors = await page.evaluate(() => {
  const secs = Array.from(document.querySelectorAll('[data-section]'));
  const vh = window.innerHeight;
  const a = secs.map((el, i) => (i === 0 ? 0 : el.offsetTop - vh * 0.34));
  for (let i = 1; i < a.length; i++) if (a[i] <= a[i - 1]) a[i] = a[i - 1] + 1;
  return a;
});

// hide every layer that is not the world itself — opacity, not display, so
// the document keeps its height and the scroll positions stay meaningful
await page.addStyleTag({
  content: `main, .masthead, .rail, .drawer, .foreground, .stage-veil, .cursor, .skip-link {
    opacity: 0 !important; pointer-events: none !important; }`,
});

await mkdir(outDir, { recursive: true });

for (const s of STILLS) {
  const from = anchors[s.section];
  const to = anchors[s.section + 1] ?? from + 1200;
  const y = Math.round(from + (to - from) * s.at);
  await page.evaluate((v) => window.scrollTo(0, v), y);
  // let the eased camera settle on the composed frame
  await page.waitForTimeout(11000);

  const shot = await page.locator('#stage').screenshot({ type: 'png' });
  const b64 = shot.toString('base64');

  const dataUrl = await page.evaluate(async ({ png, ratio, name }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const targetW = ratio > 1.7 ? 1280 : 960;
    const targetH = Math.round(targetW / ratio);
    // centre crop the viewport render to the card ratio
    const srcRatio = img.width / img.height;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (srcRatio > ratio) { sw = img.height * ratio; sx = (img.width - sw) / 2; }
    else { sh = img.width / ratio; sy = (img.height - sh) * 0.42; }
    const c = document.createElement('canvas');
    c.width = targetW; c.height = targetH;
    const x = c.getContext('2d');
    x.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
    return c.toDataURL('image/webp', 0.66);
  }, { png: b64, ratio: s.ratio, name: s.name });

  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(join(outDir, `${s.name}.webp`), buf);
  console.log(`${s.name}.webp  ${(buf.length / 1024).toFixed(1)} KB  (y=${y})`);
}

await browser.close();
