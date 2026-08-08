/* ═══════════════════════════════════════════════════════════════════════
   PRISME — filtering, search, sort and the small interface bits.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const grid = $('#grid');
  const cards = $$('.card', grid);
  const chips = $$('.chip[data-cat]');
  const countEl = $('#count');
  const emptyEl = $('#empty');
  const searchForm = $('#search');
  const input = $('#q');

  let category = 'all';
  let query = '';
  let sort = 0; // 0 featured · 1 A–Z · 2 newest first

  /* ── filtering ─────────────────────────────────────────────────────── */
  function apply() {
    const q = query.trim().toLowerCase();
    let shown = 0;

    cards.forEach((card) => {
      const inCat = category === 'all' || card.dataset.cat === category;
      const hay = `${card.dataset.keywords} ${card.textContent}`.toLowerCase();
      const match = !q || q.split(/\s+/).every((t) => hay.includes(t));
      const on = inCat && match;
      card.hidden = !on;
      if (on) shown++;
    });

    countEl.textContent = shown === 1 ? 'Showing 1 page' : `Showing ${shown} pages`;
    emptyEl.hidden = shown !== 0;

    // the flagship only spans two columns while the full set is on show
    const wide = $('.card--wide', grid);
    if (wide) wide.classList.toggle('card--wide-off', shown < 3);
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', String(on));
      });
      category = chip.dataset.cat;
      apply();
    });
  });

  input.addEventListener('input', () => { query = input.value; apply(); });
  searchForm.addEventListener('submit', (e) => e.preventDefault());
  $('#clear').addEventListener('click', () => {
    input.value = ''; query = ''; apply(); input.focus();
  });
  $('#reset').addEventListener('click', () => {
    input.value = ''; query = ''; category = 'all';
    chips.forEach((c) => {
      const on = c.dataset.cat === 'all';
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    apply();
  });

  /* ── sort ──────────────────────────────────────────────────────────── */
  const SORTS = ['Featured', 'A – Z', 'Newest'];
  const sortBtn = $('#sortBtn');
  const sortLabel = $('#sortLabel');
  sortBtn.addEventListener('click', () => {
    sort = (sort + 1) % SORTS.length;
    sortLabel.textContent = SORTS[sort];
    const ordered = cards.slice().sort((a, b) => {
      if (sort === 1) return $('h2', a).textContent.trim().localeCompare($('h2', b).textContent.trim());
      const oa = Number(a.dataset.order), ob = Number(b.dataset.order);
      return sort === 2 ? ob - oa : oa - ob;
    });
    ordered.forEach((c) => grid.appendChild(c));
  });

  /* ── search + menu toggles ─────────────────────────────────────────── */
  const searchToggle = $('#searchToggle');
  searchToggle.addEventListener('click', () => {
    const open = searchToggle.getAttribute('aria-expanded') === 'true';
    searchToggle.setAttribute('aria-expanded', String(!open));
    searchForm.hidden = open;
    if (!open) {
      $('#library').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => input.focus(), reduced ? 0 : 420);
    }
  });

  const menuToggle = $('#menuToggle');
  const drawer = $('#drawer');
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    menuToggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
    drawer.hidden = open;
  });
  drawer.addEventListener('click', (e) => { if (e.target.tagName === 'A') menuToggle.click(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menuToggle.getAttribute('aria-expanded') === 'true') menuToggle.click();
  });

  /* ── copy link ─────────────────────────────────────────────────────── */
  const toast = $('#toast');
  let toastTimer = 0;
  function say(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = new URL(btn.dataset.copy, location.href).href;
      try {
        await navigator.clipboard.writeText(url);
        say('Link copied');
      } catch {
        // clipboard is unavailable over some origins — offer the URL instead
        window.prompt('Copy this link', url);
      }
    });
  });

  /* ── scroll state + reveals ────────────────────────────────────────── */
  addEventListener('scroll', () => {
    document.body.classList.toggle('scrolled', scrollY > 8);
  }, { passive: true });

  const targets = [...cards, ...$$('[data-rv]'), ...$$('.rules li')];
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = `${Math.min(i * 70, 280)}ms`;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => io.observe(el));
  }

  apply();
})();
