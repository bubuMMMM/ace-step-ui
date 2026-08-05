/* ═══════════════════════════════════════════════════════════
   Morning Paper — landing interactions
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── Header collé + barre de progression ───────────── */
  var header = document.getElementById('siteHeader');
  var bar = document.getElementById('scrollBar');
  var ticking = false;

  /* Section courante. Sur une page de cette longueur, la navigation ne disait
     jamais où l'on se trouve. On se greffe sur la boucle de défilement
     existante plutôt que d'ajouter un second écouteur. */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var sections = navLinks.map(function (a) {
    return document.querySelector(a.getAttribute('href'));
  });

  var paint = function () {
    var y = window.scrollY;
    header.classList.toggle('is-stuck', y > 8);

    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    }

    /* La dernière section dont le haut est passé sous l'en-tête. */
    var current = -1;
    sections.forEach(function (el, i) {
      if (el && el.getBoundingClientRect().top <= 100) current = i;
    });
    navLinks.forEach(function (a, i) {
      if (i === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    ticking = false;
  };

  var onScroll = function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(paint);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  paint();

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
    var saveStateText = document.getElementById('saveStateText');
    var studioReset = document.getElementById('studioReset');
    var shareBtn = document.getElementById('shareBtn');

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
        more.style.borderLeftColor = 'var(--line-2)';
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
      /* Le bouton n'est plus pré-désactivé. Un bouton grisé n'explique jamais
         pourquoi il l'est : on laisse envoyer, et on répond par une validation
         à l'envoi. La règle :disabled reste en CSS pour l'état « envoi en
         cours » d'un formulaire réellement branché. */
    };

    var clearState = function () { saveState.classList.remove('is-on', 'is-err'); };

    grid.addEventListener('change', function () {
      clearState();
      render();
      ecrireURL();
    });

    /* Le « × » du Studio avait l'apparence d'un bouton de fermeture sans en
       être un — une zone morte au sens strict. Il remet maintenant les
       rubriques dans leur état de départ : une vraie action, qui justifie
       l'icône au lieu de la démentir. */
    if (studioReset) {
      studioReset.addEventListener('click', function () {
        var defauts = ['À la une', 'Messages', 'Agenda', 'Météo', 'Actualités', 'Focus du jour'];
        Array.prototype.forEach.call(grid.querySelectorAll('input[name="rubrique"]'), function (i) {
          i.checked = defauts.indexOf(i.value) !== -1;
        });
        clearState();
        render();
        ecrireURL();
      });
    }

    /* Sans affordance, un état dans l'URL reste une fonctionnalité que
       personne ne découvre. */
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        ecrireURL();
        var dire = function (texte, erreur) {
          saveStateText.textContent = texte;
          saveState.classList.toggle('is-err', !!erreur);
          saveState.classList.add('is-on');
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(location.href).then(function () {
            dire('Lien copié — il rouvrira ta composition à l’identique.', false);
          }, function () {
            dire('Copie refusée par le navigateur, mais l’adresse de la page contient déjà ta composition.', true);
          });
        } else {
          dire('L’adresse de la page contient ta composition — copie-la depuis la barre d’adresse.', true);
        }
      });
    }

    var pageBtns = Array.prototype.slice.call(picker.querySelectorAll('button'));

    /* Tabulation glissante : un groupe de boutons radio compte pour UN seul
       arrêt de tabulation, pas huit. Seule l'option retenue reste
       atteignable par Tab ; à l'intérieur, on circule aux flèches. */
    var majPages = function (btn) {
      pages = Number(btn.dataset.pages);
      pageBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
    };

    /* ─── L'état vit dans l'adresse ───────────────────────
       Une composition doit pouvoir se partager, se recharger et survivre à un
       Précédent. On écrit en replaceState : cocher une case ne mérite pas une
       entrée d'historique, mais l'adresse reste exacte à chaque instant.
       Rien n'est écrit tant que l'utilisateur n'a rien touché — une page
       d'arrivée garde une URL propre. */
    var ecrireURL = function () {
      var q = new URLSearchParams();
      q.set('r', checkedRubriques().map(function (i) { return i.dataset.k; }).join('.'));
      q.set('p', String(pages));
      history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
    };

    var lireURL = function () {
      var q = new URLSearchParams(location.search);
      var r = q.get('r');
      if (r !== null) {
        var voulues = r ? r.split('.') : [];
        Array.prototype.forEach.call(grid.querySelectorAll('input[name="rubrique"]'), function (i) {
          i.checked = voulues.indexOf(i.dataset.k) !== -1;
        });
      }
      var n = Number(q.get('p'));
      if (n >= 1 && n <= 8) {
        var btn = picker.querySelector('button[data-pages="' + n + '"]');
        if (btn) majPages(btn);
      }
    };

    var selectPage = function (btn, focus) {
      majPages(btn);
      if (focus) btn.focus();
      clearState();
      render();
      ecrireURL();
    };

    picker.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-pages]');
      if (btn) selectPage(btn, false);
    });

    picker.addEventListener('keydown', function (e) {
      var i = pageBtns.indexOf(document.activeElement);
      if (i === -1) return;
      var last = pageBtns.length - 1;
      var to;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = i === 0 ? last : i - 1;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = last;
      else return;

      e.preventDefault();
      selectPage(pageBtns[to], true);
    });

    /* On restaure d'abord ce que l'adresse demande, puis on aligne la
       tabulation sur le bouton réellement coché. */
    lireURL();
    pageBtns.forEach(function (b) {
      b.tabIndex = b.classList.contains('is-on') ? 0 : -1;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (checkedRubriques().length === 0) {
        saveStateText.textContent = 'Choisis au moins une rubrique avant d’enregistrer.';
        saveState.classList.add('is-on', 'is-err');
        grid.querySelector('input[name="rubrique"]').focus();
        return;
      }

      saveStateText.textContent = 'Modifications sauvegardées';
      saveState.classList.remove('is-err');
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
      /* La bordure rouge est le seul signal d'erreur pour qui voit la page ;
         aria-invalid en est l'équivalent pour qui l'écoute. */
      email.setAttribute('aria-invalid', String(!valid));

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
      email.removeAttribute('aria-invalid');
      msg.classList.remove('is-err');
      msg.textContent = '';
    });
  }
})();
