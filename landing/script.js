/* ═══════════════════════════════════════════════════════════
   Morning Paper — landing interactions
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── Header : état "collé" ─────────────────────────── */
  var header = document.getElementById('siteHeader');
  var onScroll = function () {
    header.classList.toggle('is-stuck', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─── Menu mobile ───────────────────────────────────── */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobileMenu');

  var setMenu = function (open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.hidden = !open;
  };

  burger.addEventListener('click', function () {
    setMenu(burger.getAttribute('aria-expanded') !== 'true');
  });
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      burger.focus();
    }
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 860) setMenu(false);
  });

  /* ─── Apparition au défilement ──────────────────────── */
  var revealables = document.querySelectorAll('.reveal');

  revealables.forEach(function (el) {
    el.style.setProperty('--d', el.dataset.delay || 0);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ─── Composer : rubriques + pages + aperçu ─────────── */
  var form = document.getElementById('composerForm');

  if (form) {
    var grid = document.getElementById('rubriqueGrid');
    var picker = document.getElementById('pagesPicker');
    var badge = document.getElementById('pagesBadge');
    var blocks = document.getElementById('previewBlocks');
    var empty = document.getElementById('previewEmpty');
    var foot = document.getElementById('previewFoot');
    var saveBtn = document.getElementById('saveBtn');
    var saveState = document.getElementById('saveState');

    /* Nombre de lignes d'aperçu par rubrique */
    var LINES = {
      'À la une': 4,
      'Messages': 3,
      'Agenda': 3,
      'Météo': 2,
      'Actualités': 3,
      'Finance': 2,
      'Sport': 2,
      'Focus du jour': 2,
      'Veille & IA': 3
    };

    var pages = 8;
    var saveTimer;

    var checkedRubriques = function () {
      return Array.prototype.filter.call(
        grid.querySelectorAll('input[name="rubrique"]'),
        function (i) { return i.checked; }
      );
    };

    var render = function () {
      var chosen = checkedRubriques();

      /* Aperçu : un bloc par rubrique, limité à ce que la page peut montrer */
      blocks.innerHTML = '';
      chosen.slice(0, 6).forEach(function (input, index) {
        var name = input.value;
        var li = document.createElement('li');
        li.style.animationDelay = (index * 45) + 'ms';

        var label = document.createElement('span');
        label.className = 'pb-name';
        label.textContent = name;
        li.appendChild(label);

        var count = LINES[name] || 2;
        for (var l = 0; l < count; l++) {
          var line = document.createElement('i');
          line.style.width = (58 + ((index * 17 + l * 29) % 42)) + '%';
          li.appendChild(line);
        }
        blocks.appendChild(li);
      });

      if (chosen.length > 6) {
        var more = document.createElement('li');
        more.style.borderLeftColor = 'var(--rule)';
        var moreLabel = document.createElement('span');
        moreLabel.className = 'pb-name';
        moreLabel.textContent = '+ ' + (chosen.length - 6) + ' rubrique' + (chosen.length - 6 > 1 ? 's' : '') + ' en page 2';
        more.appendChild(moreLabel);
        blocks.appendChild(more);
      }

      empty.hidden = chosen.length > 0;
      badge.textContent = pages + (pages > 1 ? ' pages' : ' page');
      foot.textContent = chosen.length + ' rubrique' + (chosen.length > 1 ? 's' : '') +
        ' · ' + pages + (pages > 1 ? ' pages' : ' page') + ' · noir & blanc';
      saveBtn.disabled = chosen.length === 0;
      saveBtn.style.opacity = chosen.length === 0 ? '.45' : '';
    };

    grid.addEventListener('change', function () {
      saveState.classList.remove('is-on');
      render();
    });

    picker.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-pages]');
      if (!btn) return;
      pages = Number(btn.dataset.pages);
      Array.prototype.forEach.call(picker.querySelectorAll('button'), function (b) {
        var on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
      });
      saveState.classList.remove('is-on');
      render();
    });

    /* Flèches gauche/droite dans le sélecteur de pages */
    picker.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var buttons = Array.prototype.slice.call(picker.querySelectorAll('button'));
      var i = buttons.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      var next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      next.focus();
      next.click();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (checkedRubriques().length === 0) return;
      saveState.classList.add('is-on');
      saveBtn.textContent = 'Édition enregistrée';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        saveBtn.textContent = 'Enregistrer mon édition';
      }, 2200);
    });

    render();
  }

  /* ─── FAQ : une seule réponse ouverte ───────────────── */
  var accordion = document.getElementById('accordion');
  if (accordion) {
    var items = accordion.querySelectorAll('details');
    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        items.forEach(function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  /* ─── Inscription ───────────────────────────────────── */
  var signup = document.getElementById('signupForm');
  if (signup) {
    var email = document.getElementById('email');
    var msg = document.getElementById('signupMsg');

    signup.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = email.value.trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      msg.classList.toggle('is-err', !valid);
      email.classList.toggle('is-err', !valid);

      if (!valid) {
        msg.textContent = 'Il nous faut une adresse e-mail valide pour t’envoyer ton édition.';
        email.focus();
        return;
      }

      msg.textContent = 'C’est noté — ta première édition s’imprime demain à 07:00.';
      signup.reset();
    });

    email.addEventListener('input', function () {
      if (!email.classList.contains('is-err')) return;
      email.classList.remove('is-err');
      msg.classList.remove('is-err');
      msg.textContent = '';
    });
  }
})();
