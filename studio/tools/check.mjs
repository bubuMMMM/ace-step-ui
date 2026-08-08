/**
 * Loads a page in headless Chromium and reports console errors, page errors
 * and failed requests, then captures desktop and 390x844 screenshots.
 *
 *   node tools/check.mjs <url> <out-prefix> [scrollTest]
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
const prefix = process.argv[3] || '/tmp/shot';
const doScroll = process.argv[4] === 'scroll';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});

const problems = { console: [], pageerrors: [], failed: [], status: [] };

async function visit(viewport, tag) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.console.push(`[${tag}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.pageerrors.push(`[${tag}] ${e.message}`));
  page.on('requestfailed', (r) => problems.failed.push(`[${tag}] ${r.url()} — ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.status.push(`[${tag}] ${r.status()} ${r.url()}`);
  });

  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${prefix}-${tag}-top.png` });

  if (doScroll) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const vh = viewport.height;
    const marks = [0.14, 0.3, 0.46, 0.62, 0.78, 0.94];
    let i = 1;
    for (const m of marks) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.floor((height - vh) * m));
      await page.waitForTimeout(5200);
      await page.screenshot({ path: `${prefix}-${tag}-${String(i).padStart(2, '0')}.png` });
      i++;
    }
  }
  await ctx.close();
}

await visit({ width: 1600, height: 1000 }, 'desktop');
await visit({ width: 390, height: 844 }, 'mobile');
await browser.close();

const out = (label, arr) => {
  const uniq = [...new Set(arr)];
  console.log(`${label}: ${uniq.length}`);
  uniq.slice(0, 25).forEach((l) => console.log('   ' + l));
};
out('page errors', problems.pageerrors);
out('console errors/warnings', problems.console);
out('failed requests', problems.failed);
out('http >= 400', problems.status);
const bad = problems.pageerrors.length + problems.failed.length + problems.status.length;
console.log(bad === 0 ? 'CLEAN' : `PROBLEMS: ${bad}`);
