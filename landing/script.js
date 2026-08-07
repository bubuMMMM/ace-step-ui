/* Prédizh — landing page interactions */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sticky nav shadow ---------- */
  var nav = document.getElementById('nav');
  var onScroll = function () { nav.classList.toggle('is-stuck', window.scrollY > 8); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- mobile menu ---------- */
  var burger = document.getElementById('burger');
  var links = document.getElementById('nav-links');
  burger.addEventListener('click', function () {
    var open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  links.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      links.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------- reveal on scroll ---------- */
  var revealables = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- animated hero counter ---------- */
  var counter = document.querySelector('[data-count]');
  if (counter && !reduced && 'IntersectionObserver' in window) {
    var target = Number(counter.dataset.count);
    var countObserver = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      countObserver.disconnect();
      var start = performance.now();
      var tick = function (now) {
        var p = Math.min((now - start) / 1100, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var value = target * eased;
        counter.textContent = (value / 1000).toFixed(1).replace('.', ',') + 'k';
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    countObserver.observe(counter);
  }

  /* ---------- app tabs (phone mockup) ---------- */
  var tabs = document.querySelectorAll('.app__tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
    });
  });

  /* ---------- rewards carousel ---------- */
  var rail = document.getElementById('rail');
  var prev = document.getElementById('rail-prev');
  var next = document.getElementById('rail-next');

  var step = function () {
    var card = rail.querySelector('.rcard');
    return card ? card.getBoundingClientRect().width + 16 : 220;
  };
  // the rail carries 4px of scroll padding, so snapping parks it a few px in
  var TOL = 12;
  var syncButtons = function () {
    prev.disabled = rail.scrollLeft <= TOL;
    next.disabled = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - TOL;
  };
  prev.addEventListener('click', function () {
    rail.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' });
  });
  next.addEventListener('click', function () {
    rail.scrollBy({ left: step(), behavior: reduced ? 'auto' : 'smooth' });
  });
  rail.addEventListener('scroll', syncButtons, { passive: true });
  window.addEventListener('resize', syncButtons);
  syncButtons();

  /* ---------- leaderboard scope toggle ---------- */
  var toggle = document.getElementById('toggle');
  toggle.addEventListener('click', function (e) {
    var opt = e.target.closest('.toggle__opt');
    if (!opt || opt.classList.contains('is-active')) return;

    toggle.querySelectorAll('.toggle__opt').forEach(function (o) {
      o.classList.remove('is-active');
      o.setAttribute('aria-selected', 'false');
    });
    opt.classList.add('is-active');
    opt.setAttribute('aria-selected', 'true');

    var scope = opt.dataset.scope;
    document.querySelectorAll('.player').forEach(function (player) {
      var pts = player.dataset[scope + 'Pts'];
      if (pts) player.querySelector('.player__pts').textContent = pts;
    });
  });

  /* ---------- signup form ---------- */
  var form = document.getElementById('signup');
  var msg = document.getElementById('signup-msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = form.querySelector('input');
    var value = input.value.trim();
    var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

    msg.style.color = valid ? '' : '#FFD1DF';
    msg.textContent = valid
      ? 'Merci ! On te tient au courant. 🖤'
      : 'Oups, il nous faut une adresse email valide.';
    if (valid) input.value = '';
  });
})();
