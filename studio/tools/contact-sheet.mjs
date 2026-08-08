/**
 * Renders a contact sheet of generated cutouts over a night background so
 * they can be reviewed the way they will actually be seen.
 *
 *   node tools/contact-sheet.mjs <out.png> <file.webp> [...]
 */
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const [out, ...files] = process.argv.slice(2);
if (!out || !files.length) {
  console.error('usage: node tools/contact-sheet.mjs <out.png> <file.webp> ...');
  process.exit(1);
}

const rows = Math.ceil(files.length / 2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 300 * rows + 40 } });
const cards = [];
for (const f of files) {
  const b64 = (await readFile(f)).toString('base64');
  cards.push(`<div style="position:relative;height:290px;background:linear-gradient(180deg,#131c2b,#05070b);overflow:hidden">
  <img src="data:image/webp;base64,${b64}" style="position:absolute;bottom:0;left:0;width:100%">
  <span style="position:absolute;top:5px;left:7px;color:#ece4d6;font:11px monospace">${f.split('/').pop()}</span>
</div>`);
}
await page.setContent(`<body style="margin:0;background:#0a0f18;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px">${cards.join('')}</body>`);
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${out}`);
