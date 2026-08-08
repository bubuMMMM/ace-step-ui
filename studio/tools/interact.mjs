/**
 * End-to-end interaction test across the whole library.
 *   node tools/interact.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://localhost:4173';
const shots = process.env.SHOT_DIR || '/tmp';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});

const fails = [];
const ok = [];
const check = (name, cond, detail = '') => {
  (cond ? ok : fails).push(`${cond ? 'PASS' : 'FAIL'} · ${name}${detail ? ` — ${detail}` : ''}`);
};

function watch(page, tag) {
  page.on('pageerror', (e) => fails.push(`FAIL · ${tag} page error — ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) fails.push(`FAIL · ${tag} ${r.status()} ${r.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error') fails.push(`FAIL · ${tag} console — ${m.text()}`); });
}

/* ── 1 · library: search, filter, sort, menu ───────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'library');
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  await page.click('#searchToggle');
  await page.fill('#q', 'fashion');
  await page.waitForTimeout(400);
  check('library search filters to one card', (await page.locator('.card:visible').count()) === 1,
    await page.textContent('#count'));

  await page.fill('#q', 'zzzz');
  await page.waitForTimeout(300);
  check('library empty state appears', await page.locator('#empty').isVisible());
  await page.click('#reset');
  await page.waitForTimeout(300);
  check('library reset restores five cards', (await page.locator('.card:visible').count()) === 5);

  await page.click('.chip[data-cat="404"]');
  await page.waitForTimeout(300);
  check('category chip filters', (await page.locator('.card:visible').count()) === 1);
  check('chip announces pressed state',
    (await page.getAttribute('.chip[data-cat="404"]', 'aria-pressed')) === 'true');
  await page.click('.chip[data-cat="all"]');
  await page.waitForTimeout(200);

  const firstBefore = await page.locator('.card h2').first().textContent();
  await page.click('#sortBtn');
  await page.waitForTimeout(300);
  const firstAfter = await page.locator('.card h2').first().textContent();
  check('sort reorders the grid', firstBefore.trim() !== firstAfter.trim(), `${firstBefore.trim()} → ${firstAfter.trim()}`);

  const imgs = await page.evaluate(() => Array.from(document.images).map((i) => [i.currentSrc, i.naturalWidth]));
  check('all thumbnails decoded', imgs.every(([, w]) => w > 0), JSON.stringify(imgs.filter(([, w]) => !w)));

  // navigating into a page and back out
  await page.click('.card--wide .card__link');
  await page.waitForLoadState('load');
  check('library links into Kage', page.url().includes('/sites/kage/'));
  await ctx.close();
}

/* ── 2 · kage: anchor nav, rail state, foreground handoff, play ────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'kage');
  await page.goto(`${base}/sites/kage/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(9000);

  check('kage webgl layer is live', await page.evaluate(() => document.body.classList.contains('stage-ready')));
  check('hero words were split for reveal', (await page.locator('#hero-title .w').count()) > 0);
  check('hero foreground set is active',
    (await page.getAttribute('.fg-set[data-fg="hero"]', 'data-state')) === 'active');

  // anchor navigation should travel and land on the chapter
  await page.click('.masthead__nav a[href="#chapter-03"]');
  await page.waitForTimeout(4200);
  const y = await page.evaluate(() => window.scrollY);
  check('anchor navigation travels', y > 2000, `scrollY=${y}`);
  check('rail marks the active chapter',
    (await page.getAttribute('.rail a[data-rail="chapter-03"]', 'aria-current')) === 'true');
  check('previous foreground set handed off',
    (await page.getAttribute('.fg-set[data-fg="hero"]', 'data-state')) !== 'active');
  check('chapter 03 foreground is active',
    (await page.getAttribute('.fg-set[data-fg="chapter-03"]', 'data-state')) === 'active');

  // the camera actually moved with the scroll
  await page.mouse.move(700, 500);
  const camA = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(1600);
  const camB = await page.evaluate(() => window.scrollY);
  check('wheel scrolling advances the walk', camB > camA, `${camA} → ${camB}`);

  // play control on an editorial card
  const play = page.locator('#chapter-03 .play').first();
  await play.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.scrollY);
  await play.click();
  await page.waitForTimeout(2200);
  const during = await page.evaluate(() => window.scrollY);
  check('play control drives the sequence', during !== before, `${before} → ${during}`);
  check('play control reports its state', await play.evaluate((el) => el.classList.contains('is-playing')));

  // walk the rest of the page so every lazy card has had its chance
  await page.evaluate(async () => {
    for (let y = window.scrollY; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await page.waitForTimeout(2500);
  const stills = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.card__frame img')).map((i) => i.naturalWidth));
  check('all editorial stills decoded', stills.length === 8 && stills.every((w) => w > 0), JSON.stringify(stills));
  await ctx.close();
}

/* ── 3 · kage at 390×844: drawer, layout, no horizontal scroll ─────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, 'kage-390');
  await page.goto(`${base}/sites/kage/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(8000);

  check('390 · no horizontal overflow',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await page.evaluate(() => `${document.documentElement.scrollWidth} vs ${window.innerWidth}`));
  await page.click('#burger');
  await page.waitForTimeout(600);
  check('390 · drawer opens', await page.locator('#drawer').isVisible());
  await page.click('#drawer a[href="#chapter-02"]');
  await page.waitForTimeout(3000);
  check('390 · drawer closes after choosing', !(await page.locator('#drawer').isVisible()));
  check('390 · drawer link navigated', await page.evaluate(() => window.scrollY) > 500);
  await ctx.close();
}

/* ── 4 · the other four pages at 390×844 ───────────────────────────────── */
for (const [slug, path] of [
  ['library', '/'],
  ['halo', '/sites/halo/index.html'],
  ['atelier-noir', '/sites/atelier-noir/index.html'],
  ['signal-lost', '/sites/signal-lost/index.html'],
  ['meridian', '/sites/meridian/index.html'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, `${slug}-390`);
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(slug === 'library' ? 3500 : 2500);
  check(`390 · ${slug} no horizontal overflow`,
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await page.evaluate(() => `${document.documentElement.scrollWidth} vs ${window.innerWidth}`));
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}/m-${slug}.png` });
  await ctx.close();
}

/* ── 5 · reduced motion keeps the whole read ───────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watch(page, 'kage-reduced');
  await page.goto(`${base}/sites/kage/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(7000);
  const hidden = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal], [data-reveal-words]'));
    return els.filter((el) => Number(getComputedStyle(el).opacity) < 0.9).length;
  });
  check('reduced motion · every block is readable at once', hidden === 0, `${hidden} still hidden`);
  const words = await page.evaluate(() => {
    const w = Array.from(document.querySelectorAll('.w > i'));
    return w.filter((el) => Number(getComputedStyle(el).opacity) < 0.9).length;
  });
  check('reduced motion · split words are visible', words === 0, `${words} hidden words`);
  await page.screenshot({ path: `${shots}/reduced.png` });
  await ctx.close();
}

await browser.close();
ok.forEach((l) => console.log(l));
fails.forEach((l) => console.log(l));
console.log(`\n${ok.length} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
