/* ═══════════════════════════════════════════════════════════════════════
   KAGE · page orchestration
   Scroll drives one continuous camera. Sections drive the foreground
   layers, the rail and the reveals. Nothing moves without a reason.
   ═══════════════════════════════════════════════════════════════════════ */

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;

const body = document.body;
const sections = Array.from(document.querySelectorAll('[data-section]'));
const railLinks = Array.from(document.querySelectorAll('.rail a'));
const navLinks = Array.from(document.querySelectorAll('.masthead__nav a'));
const fgSets = new Map(
  Array.from(document.querySelectorAll('.fg-set')).map((el) => [el.dataset.fg, el])
);
const railMeter = document.getElementById('railMeter');

let world = null;
let scrollY = window.scrollY;
let viewportH = window.innerHeight;
let anchors = [];
let activeIndex = -1;

/* ── section anchors: one composed shot per section ──────────────────── */
function measure() {
  viewportH = window.innerHeight;
  anchors = sections.map((el, i) => (i === 0 ? 0 : el.offsetTop - viewportH * 0.34));
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i] <= anchors[i - 1]) anchors[i] = anchors[i - 1] + 1;
  }
}

/** position in "shot space": 0 → hero, 1 → the last shot */
function shotProgress(y) {
  const last = anchors.length - 1;
  if (y <= anchors[0]) return 0;
  if (y >= anchors[last]) return 1;
  let i = 0;
  while (i < last && y >= anchors[i + 1]) i++;
  const span = anchors[i + 1] - anchors[i];
  const local = span > 0 ? (y - anchors[i]) / span : 0;
  return (i + local) / last;
}

function currentIndex(y) {
  const probe = y + viewportH * 0.38;
  let i = 0;
  for (let k = 0; k < anchors.length; k++) if (probe >= anchors[k]) i = k;
  return i;
}

/* ── foreground cutout layers ────────────────────────────────────────── */
const layerState = new WeakMap();

function initLayers() {
  document.querySelectorAll('.fg-layer').forEach((el) => {
    layerState.set(el, { y: 34, py: 34, px: 0, tx: 0 });
  });
}

function setActiveSection(index) {
  if (index === activeIndex) return;
  const prev = sections[activeIndex];
  const next = sections[index];
  activeIndex = index;

  if (prev) {
    const set = fgSets.get(prev.dataset.section);
    if (set) set.dataset.state = 'leaving';
  }
  fgSets.forEach((set, key) => {
    if (!next || key !== next.dataset.section) {
      if (set.dataset.state === 'active') set.dataset.state = 'leaving';
    }
  });
  if (next) {
    const set = fgSets.get(next.dataset.section);
    if (set) set.dataset.state = 'active';
  }

  const id = next ? next.id : '';
  railLinks.forEach((a) => {
    const on = a.dataset.rail === id || (index === 0 && a.dataset.rail === 'top');
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  navLinks.forEach((a) => {
    const on = a.getAttribute('href') === `#${id}`;
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

/* ── reveals ─────────────────────────────────────────────────────────── */
function splitWords() {
  document.querySelectorAll('[data-reveal-words]').forEach((el) => {
    if (el.dataset.split === 'true') return;
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      const inner = document.createElement('i');
      inner.textContent = word;
      inner.style.setProperty('--d', `${Math.min(i * 0.048, 0.9)}s`);
      span.appendChild(inner);
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.dataset.split = 'true';
  });
}

function observeReveals() {
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-words]');
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      // supporting elements arrive one after another, not as a block
      const group = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;
      if (!el.hasAttribute('data-reveal-words')) {
        el.style.setProperty('--d', `${Math.min(group * 0.07, 0.42)}s`);
      }
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  targets.forEach((el) => io.observe(el));
}

/* ── eased programmatic scrolling (anchors + card playback) ──────────── */
let scrollAnim = null;
function cancelScrollAnim() {
  if (scrollAnim) {
    scrollAnim.cancelled = true;
    if (scrollAnim.onEnd) scrollAnim.onEnd(false);
    scrollAnim = null;
  }
}
function scrollToY(target, duration = 1400, onEnd = null) {
  cancelScrollAnim();
  const max = document.documentElement.scrollHeight - viewportH;
  const to = Math.max(0, Math.min(max, target));
  if (reduced || duration <= 0) {
    window.scrollTo(0, to);
    if (onEnd) onEnd(true);
    return;
  }
  const from = window.scrollY;
  const dist = to - from;
  if (Math.abs(dist) < 2) { if (onEnd) onEnd(true); return; }
  const start = performance.now();
  const anim = { cancelled: false, onEnd };
  scrollAnim = anim;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const step = (now) => {
    if (anim.cancelled) return;
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, from + dist * ease(t));
    if (t < 1) requestAnimationFrame(step);
    else { scrollAnim = null; if (onEnd) onEnd(true); }
  };
  requestAnimationFrame(step);
}

/* ── card playback: the "still" plays as a live camera move ──────────── */
function initPlayButtons() {
  document.querySelectorAll('.play').forEach((btn) => {
    const section = btn.closest('[data-section]');
    if (!section) return;
    const label = btn.getAttribute('aria-label') || 'Play the sequence';
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-playing')) {
        cancelScrollAnim();
        return;
      }
      const index = sections.indexOf(section);
      const from = anchors[index] ?? section.offsetTop;
      const to = anchors[index + 1] ?? (from + section.offsetHeight);
      btn.classList.add('is-playing');
      btn.setAttribute('aria-label', `Stop the sequence — ${label}`);
      const finish = () => {
        btn.classList.remove('is-playing');
        btn.setAttribute('aria-label', label);
      };
      if (reduced) {
        window.scrollTo(0, from);
        finish();
        return;
      }
      window.scrollTo(0, from);
      scrollToY(to - 4, 7000, finish);
    });
  });
}

/* ── navigation ──────────────────────────────────────────────────────── */
function initAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target && id !== 'top') return;
      e.preventDefault();
      closeDrawer();
      const index = sections.indexOf(target);
      const y = index >= 0 ? (anchors[index] ?? target.offsetTop) : (target ? target.offsetTop : 0);
      scrollToY(y, reduced ? 0 : 1500);
      // move focus for keyboard users without a second jump
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      if (history.replaceState) history.replaceState(null, '', `#${id}`);
    });
  });
}

const burger = document.getElementById('burger');
const drawer = document.getElementById('drawer');
function openDrawer() {
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add('is-open'));
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Close chapter menu');
}
function closeDrawer() {
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Open chapter menu');
  const done = () => { drawer.hidden = true; };
  if (reduced) done();
  else setTimeout(done, 480);
}
if (burger && drawer) {
  burger.addEventListener('click', () => {
    if (burger.getAttribute('aria-expanded') === 'true') closeDrawer();
    else openDrawer();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
}

/* ── custom cursor, fine pointers only ───────────────────────────────── */
function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cursor = document.getElementById('cursor');
  if (!cursor) return;
  const dot = cursor.querySelector('i');
  const ring = cursor.querySelector('b');
  let x = window.innerWidth / 2, y = window.innerHeight / 2;
  let rx = x, ry = y;
  let shown = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; rx = x; ry = y; body.classList.add('cursor-on'); }
    const interactive = e.target.closest('a, button');
    body.classList.toggle('cursor-active', !!interactive);
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    shown = false;
    body.classList.remove('cursor-on');
  });

  const tick = () => {
    rx += (x - rx) * 0.16;
    ry += (y - ry) * 0.16;
    dot.style.setProperty('--x', `${x}px`);
    dot.style.setProperty('--y', `${y}px`);
    ring.style.setProperty('--rx', `${rx}px`);
    ring.style.setProperty('--ry', `${ry}px`);
    ring.style.setProperty('--rs', body.classList.contains('cursor-active') ? '1.5' : '1');
    requestAnimationFrame(tick);
  };
  tick();
}

/* ── frame loop ──────────────────────────────────────────────────────── */
let pointerX = 0, pointerY = 0;
let lastScroll = 0;

function tick() {
  requestAnimationFrame(tick);

  scrollY = window.scrollY;
  const p = shotProgress(scrollY);
  if (world) world.setProgress(p);
  if (railMeter) railMeter.style.setProperty('--p', p.toFixed(4));

  const index = currentIndex(scrollY);
  if (index !== activeIndex) setActiveSection(index);

  body.classList.toggle('scrolled', scrollY > 40);
  // the masthead steps aside while travelling down, returns on the way up
  if (!reduced) {
    const down = scrollY > lastScroll + 2;
    const up = scrollY < lastScroll - 2;
    if (down && scrollY > viewportH * 0.9) body.classList.add('nav-hidden');
    else if (up) body.classList.remove('nav-hidden');
  }
  lastScroll = scrollY;

  // foreground parallax, lerped by hand so the state transition stays clean
  document.querySelectorAll('.fg-set[data-state]').forEach((set) => {
    const leaving = set.dataset.state === 'leaving';
    const active = set.dataset.state === 'active';
    if (!leaving && !active) return;
    const kids = set.children;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      const st = layerState.get(el);
      if (!st) continue;
      const depth = parseFloat(el.dataset.depth || '0.4');
      const restY = active ? 0 : -26 * depth;
      const targetY = reduced ? restY : restY + (active ? Math.sin(scrollY * 0.0016 + depth * 3) * 6 * depth : 0);
      const targetX = reduced ? 0 : pointerX * 26 * depth;
      st.py += (targetY - st.py) * (reduced ? 1 : 0.08);
      st.px += (targetX - st.px) * (reduced ? 1 : 0.06);
      el.style.setProperty('--py', `${st.py.toFixed(2)}px`);
      el.style.setProperty('--px', `${st.px.toFixed(2)}px`);
    }
  });

  if (world) {
    world.setPointer(pointerX, pointerY);
    world.frame();
  }
}

/* ── boot ────────────────────────────────────────────────────────────── */
function reveal() {
  body.classList.remove('is-loading');
}

async function boot() {
  measure();
  initLayers();
  splitWords();
  initAnchors();
  initPlayButtons();
  initCursor();
  observeReveals();
  setActiveSection(currentIndex(window.scrollY));

  window.addEventListener('resize', () => {
    measure();
    if (world) world.resize();
  }, { passive: true });

  window.addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  ['wheel', 'touchstart', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      if (evt === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) return;
      cancelScrollAnim();
      document.querySelectorAll('.play.is-playing').forEach((b) => b.classList.remove('is-playing'));
    }, { passive: true });
  });

  reducedQuery.addEventListener?.('change', (e) => {
    reduced = e.matches;
    if (reduced) document.querySelectorAll('[data-reveal], [data-reveal-words]').forEach((el) => el.classList.add('is-in'));
  });

  // the world is optional: without it the page is still a complete read
  try {
    const canvas = document.getElementById('stage');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('no webgl');
    const { createWorld } = await import('./world.js');
    world = createWorld(canvas, { reducedMotion: reduced });
    if (!world) throw new Error('world failed');
    world.frame();
    body.classList.add('stage-ready');
  } catch (err) {
    body.classList.add('stage-off');
    console.info('Kage: running without the WebGL layer —', err.message);
  }

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) { /* not fatal */ }
  }
  measure();
  reveal();
  tick();

  // deep links land on the right shot
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    const index = sections.indexOf(target);
    if (index > 0) requestAnimationFrame(() => window.scrollTo(0, anchors[index]));
  }

  document.addEventListener('visibilitychange', () => {
    if (!world) return;
    if (document.hidden) world.stop();
    else world.start();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
