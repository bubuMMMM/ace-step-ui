/* ═══════════════════════════════════════════════════════════
   Morning Paper — L'ÉDITION
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };

  /* ─── La date de parution ─────────────────────────────
     Une édition porte la date du jour. Celle-ci se compose à l'ouverture :
     la page est littéralement l'édition d'aujourd'hui. Le HTML contient une
     date écrite en dur comme repli, pour qui n'exécute pas de script. */
  var today = document.getElementById('today');
  if (today) {
    try {
      today.textContent = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(new Date());
    } catch (e) { /* on garde le repli du HTML */ }
  }

  var ppDate = document.getElementById('ppDate');
  if (ppDate) {
    try {
      var demain = new Date();
      demain.setDate(demain.getDate() + 1);
      ppDate.textContent = cap(new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
      }).format(demain)) + ' · 07:00';
    } catch (e) { /* repli */ }
  }

  /* ─── Titre courant et rubrique en cours ──────────────
     Un seul écouteur de défilement, cadencé par requestAnimationFrame,
     alimente les deux. */
  var runhead = document.getElementById('runhead');
  var runheadSec = document.getElementById('runheadSec');
  var fold = document.querySelector('.fold');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.rubriques a[href^="#"]'));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var ticking = false;

  var paint = function () {
    if (runhead && fold) {
      runhead.classList.toggle('is-on', fold.getBoundingClientRect().bottom < 0);
    }

    var current = -1;
    sections.forEach(function (el, i) {
      if (el && el.getBoundingClientRect().top <= 90) current = i;
    });
    navLinks.forEach(function (a, i) {
      if (i === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (runheadSec && current > -1) runheadSec.textContent = navLinks[current].textContent.trim();

    ticking = false;
  };

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(paint);
  }, { passive: true });
  paint();

  /* ─── L'atelier ───────────────────────────────────────── */
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

    var LIGNES = {
      'À la une': 4, 'Messages': 3, 'Agenda': 3, 'Météo': 2, 'Actualités': 3,
      'Finance': 2, 'Sport': 2, 'Focus du jour': 2, 'Veille & IA': 3
    };
    var DEFAUTS = ['À la une', 'Messages', 'Agenda', 'Météo', 'Actualités', 'Focus du jour'];

    var pages = 8;
    var saveTimer;

    var cochees = function () {
      return Array.prototype.filter.call(
        grid.querySelectorAll('input[name="rubrique"]'),
        function (i) { return i.checked; }
      );
    };

    var clearState = function () { saveState.classList.remove('is-on', 'is-err'); };

    var render = function () {
      var choisies = cochees();

      blocks.innerHTML = '';
      choisies.slice(0, 6).forEach(function (input, index) {
        var nom = input.value;
        var li = document.createElement('li');
        li.style.animationDelay = (index * 45) + 'ms';

        var label = document.createElement('span');
        label.className = 'pb-name';
        label.textContent = nom;
        li.appendChild(label);

        var n = LIGNES[nom] || 2;
        for (var l = 0; l < n; l++) {
          var trait = document.createElement('i');
          trait.style.width = (58 + ((index * 17 + l * 29) % 42)) + '%';
          li.appendChild(trait);
        }
        blocks.appendChild(li);
      });

      if (choisies.length > 6) {
        var plus = document.createElement('li');
        var t = document.createElement('span');
        t.className = 'pb-name';
        t.textContent = '+ ' + (choisies.length - 6) + ' rubrique' +
          (choisies.length - 6 > 1 ? 's' : '') + ' en page 2';
        plus.appendChild(t);
        blocks.appendChild(plus);
      }

      empty.hidden = choisies.length > 0;
      badge.textContent = pages + (pages > 1 ? ' pages' : ' page');
      foot.textContent = choisies.length + ' rubrique' + (choisies.length > 1 ? 's' : '') +
        ' · ' + pages + (pages > 1 ? ' pages' : ' page') + ' · noir & blanc';
    };

    var pageBtns = Array.prototype.slice.call(picker.querySelectorAll('button'));

    var majPages = function (btn) {
      pages = Number(btn.dataset.pages);
      pageBtns.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
    };

    /* L'état vit dans l'adresse : une composition se partage et se retrouve.
       replaceState — cocher une case ne mérite pas une entrée d'historique —
       et rien n'est écrit tant que rien n'a été touché. */
    var ecrireURL = function () {
      var q = new URLSearchParams();
      q.set('r', cochees().map(function (i) { return i.dataset.k; }).join('.'));
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

    grid.addEventListener('change', function () {
      clearState();
      render();
      ecrireURL();
    });

    /* Le « × » est un vrai bouton : il remet les rubriques d'origine. */
    if (studioReset) {
      studioReset.addEventListener('click', function () {
        Array.prototype.forEach.call(grid.querySelectorAll('input[name="rubrique"]'), function (i) {
          i.checked = DEFAUTS.indexOf(i.value) !== -1;
        });
        clearState();
        render();
        ecrireURL();
      });
    }

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
            dire('Lien copié — il rouvrira cette composition à l’identique.', false);
          }, function () {
            dire('Copie refusée par le navigateur, mais l’adresse contient déjà votre composition.', true);
          });
        } else {
          dire('L’adresse de la page contient votre composition — copiez-la depuis la barre d’adresse.', true);
        }
      });
    }

    picker.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-pages]');
      if (btn) selectPage(btn, false);
    });

    /* Groupe de boutons radio : un seul arrêt de tabulation, flèches à
       l'intérieur, Début et Fin aux extrémités. */
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

    lireURL();
    pageBtns.forEach(function (b) {
      b.tabIndex = b.classList.contains('is-on') ? 0 : -1;
    });

    /* Le bouton n'est jamais pré-désactivé : on laisse envoyer et on répond. */
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (cochees().length === 0) {
        saveStateText.textContent = 'Choisissez au moins une rubrique.';
        saveState.classList.add('is-on', 'is-err');
        grid.querySelector('input[name="rubrique"]').focus();
        return;
      }

      saveStateText.textContent = 'Composition enregistrée';
      saveState.classList.remove('is-err');
      saveState.classList.add('is-on');
      saveBtn.textContent = 'Composition enregistrée';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        saveBtn.textContent = 'Enregistrer cette composition';
      }, 2200);
    });

    render();
  }

  /* ─── Courrier : une seule réponse ouverte ────────────── */
  var accordion = document.getElementById('accordion');
  if (accordion) {
    var items = accordion.querySelectorAll('details');
    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        items.forEach(function (other) { if (other !== item) other.open = false; });
      });
    });
  }

  /* ─── Abonnement ──────────────────────────────────────── */
  var signup = document.getElementById('signupForm');
  if (signup) {
    var email = document.getElementById('email');
    var msg = document.getElementById('signupMsg');

    signup.addEventListener('submit', function (e) {
      e.preventDefault();
      var valeur = email.value.trim();
      var valide = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeur);

      msg.classList.toggle('is-err', !valide);
      email.classList.toggle('is-err', !valide);
      email.setAttribute('aria-invalid', String(!valide));

      if (!valide) {
        msg.textContent = 'Il nous faut une adresse e-mail valide pour vous envoyer votre édition.';
        email.focus();
        return;
      }

      msg.textContent = 'C’est noté — votre première édition s’imprime demain à 07:00.';
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
