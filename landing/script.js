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

  /* ─── Composer : quatre sous-sections, un seul état ───
     Rubriques, format, livraison et récapitulatif partagent un état unique
     qui pilote l'aperçu, le résumé et l'adresse de la page. */
  var form = document.getElementById('composerForm');

  if (form) {
    var grid = document.getElementById('rubriqueGrid');
    var badge = document.getElementById('pagesBadge');
    var blocks = document.getElementById('previewBlocks');
    var empty = document.getElementById('previewEmpty');
    var foot = document.getElementById('previewFoot');
    var saveBtn = document.getElementById('saveBtn');
    var saveState = document.getElementById('saveState');
    var saveStateText = document.getElementById('saveStateText');
    var studioReset = document.getElementById('studioReset');
    var shareBtn = document.getElementById('shareBtn');
    var joursNote = document.getElementById('joursNote');

    var LIGNES = {
      'À la une': 4, 'Messages': 3, 'Agenda': 3, 'Météo': 2, 'Actualités': 3,
      'Finance': 2, 'Sport': 2, 'Focus du jour': 2, 'Veille & IA': 3
    };
    var DEFAUTS = ['À la une', 'Messages', 'Agenda', 'Météo', 'Actualités', 'Focus du jour'];
    var ORDRE = ['l', 'm', 'e', 'j', 'v', 's', 'd'];
    var NOMS = { l:'lundi', m:'mardi', e:'mercredi', j:'jeudi', v:'vendredi', s:'samedi', d:'dimanche' };

    var etat = { pages:8, format:'A4', verso:1, heure:'07:00', jours:['l','m','e','j','v'] };
    var saveTimer;

    var cochees = function () {
      return Array.prototype.filter.call(
        grid.querySelectorAll('input[name="rubrique"]'),
        function (i) { return i.checked; }
      );
    };
    var clearState = function () { saveState.classList.remove('is-on', 'is-err'); };
    var pluriel = function (n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); };

    /* Groupe de boutons radio : un seul arrêt de tabulation, flèches à
       l'intérieur, Début et Fin aux extrémités. Le même câblage sert aux
       quatre barres segmentées. */
    var groupeRadio = function (el, attr, surChoix) {
      if (!el) return { poser: function () {} };
      var btns = Array.prototype.slice.call(el.querySelectorAll('button'));
      var poser = function (btn, focus) {
        btns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-checked', String(on));
          b.tabIndex = on ? 0 : -1;
        });
        if (focus) btn.focus();
      };
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-' + attr + ']');
        if (!b) return;
        poser(b, false); surChoix(b.getAttribute('data-' + attr)); majTout();
      });
      el.addEventListener('keydown', function (e) {
        var i = btns.indexOf(document.activeElement);
        if (i === -1) return;
        var last = btns.length - 1, to;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = i === last ? 0 : i + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = i === 0 ? last : i - 1;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = last;
        else return;
        e.preventDefault();
        poser(btns[to], true); surChoix(btns[to].getAttribute('data-' + attr)); majTout();
      });
      btns.forEach(function (b) { b.tabIndex = b.classList.contains('is-on') ? 0 : -1; });
      return {
        poser: function (val) {
          var b = el.querySelector('button[data-' + attr + '="' + val + '"]');
          if (b) poser(b, false);
        }
      };
    };

    var gPages  = groupeRadio(document.getElementById('pagesPicker'),  'pages',  function (v) { etat.pages = Number(v); });
    var gFormat = groupeRadio(document.getElementById('formatPicker'), 'format', function (v) { etat.format = v; });
    var gVerso  = groupeRadio(document.getElementById('versoPicker'),  'verso',  function (v) { etat.verso = Number(v); });
    var gHeure  = groupeRadio(document.getElementById('heurePicker'),  'heure',  function (v) { etat.heure = v; });

    /* Jours : sept bascules indépendantes, pas un groupe radio. On refuse
       de tout décocher — une édition sans jour de parution n'existe pas. */
    var joursEl = document.getElementById('joursPicker');
    if (joursEl) {
      joursEl.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-jour]');
        if (!b) return;
        var k = b.getAttribute('data-jour');
        var i = etat.jours.indexOf(k);
        if (i === -1) etat.jours.push(k);
        else if (etat.jours.length > 1) etat.jours.splice(i, 1);
        else return;
        b.classList.toggle('is-on', i === -1);
        b.setAttribute('aria-pressed', String(i === -1));
        majTout();
      });
    }

    var libelleJours = function () {
      var j = ORDRE.filter(function (k) { return etat.jours.indexOf(k) !== -1; });
      if (j.length === 7) return 'Tous les jours';
      if (j.join('') === 'lmejv') return 'Du lundi au vendredi';
      if (j.join('') === 'sd') return 'Le week-end';
      if (j.length === 1) return 'Le ' + NOMS[j[0]];
      return pluriel(j.length, 'jour') + ' par semaine';
    };

    /* Coût d'encre et de papier, déduit des réglages plutôt qu'affiché en
       dur : feuilles par mois × prix moyen d'une impression noir et blanc. */
    var coutMensuel = function () {
      var feuilles = Math.ceil(etat.pages / (etat.verso ? 2 : 1));
      var parMois = feuilles * etat.jours.length * 4.33;
      return Math.max(0.5, Math.round(parMois * 0.025 * 2) / 2);
    };

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
        t.textContent = '+ ' + pluriel(choisies.length - 6, 'rubrique') + ' en page 2';
        plus.appendChild(t);
        blocks.appendChild(plus);
      }

      empty.hidden = choisies.length > 0;
      badge.textContent = etat.pages + (etat.pages > 1 ? ' pages' : ' page');
      foot.textContent = pluriel(choisies.length, 'rubrique') + ' · ' +
        pluriel(etat.pages, 'page') + ' · noir & blanc';

      var r = document.getElementById('recapRub');
      var f = document.getElementById('recapFmt');
      var v = document.getElementById('recapLiv');
      var e = document.getElementById('recapEncre');
      if (r) r.textContent = choisies.length ? pluriel(choisies.length, 'rubrique') : 'Aucune rubrique choisie';
      if (f) f.textContent = pluriel(etat.pages, 'page') + ' ' + etat.format + (etat.verso ? ' recto-verso' : ' recto');
      if (v) v.textContent = libelleJours() + ' à ' + etat.heure;
      if (e) e.textContent = 'Noir & blanc · ≈ ' + coutMensuel().toString().replace('.', ',') + '€ par mois';
      if (joursNote) {
        joursNote.textContent = libelleJours() + '. ' +
          (etat.jours.length === 7 ? 'Y compris le week-end.' : 'Aucune impression les autres jours.');
      }
    };

    var ecrireURL = function () {
      var q = new URLSearchParams();
      q.set('r', cochees().map(function (i) { return i.getAttribute('data-k'); }).join('.'));
      q.set('p', String(etat.pages));
      q.set('f', etat.format);
      q.set('v', String(etat.verso));
      q.set('h', etat.heure);
      q.set('j', ORDRE.filter(function (k) { return etat.jours.indexOf(k) !== -1; }).join(''));
      history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
    };

    var lireURL = function () {
      var q = new URLSearchParams(location.search);
      var r = q.get('r');
      if (r !== null) {
        var voulues = r ? r.split('.') : [];
        Array.prototype.forEach.call(grid.querySelectorAll('input[name="rubrique"]'), function (i) {
          i.checked = voulues.indexOf(i.getAttribute('data-k')) !== -1;
        });
      }
      var n = Number(q.get('p'));
      if (n >= 1 && n <= 8) { etat.pages = n; gPages.poser(String(n)); }

      var f = q.get('f');
      if (f === 'A4' || f === 'A5') { etat.format = f; gFormat.poser(f); }

      var v = q.get('v');
      if (v === '0' || v === '1') { etat.verso = Number(v); gVerso.poser(v); }

      var h = q.get('h');
      if (h && document.querySelector('#heurePicker button[data-heure="' + h + '"]')) {
        etat.heure = h; gHeure.poser(h);
      }

      var j = q.get('j');
      if (j) {
        var voulus = j.split('').filter(function (k) { return ORDRE.indexOf(k) !== -1; });
        if (voulus.length) {
          etat.jours = voulus;
          Array.prototype.forEach.call(joursEl.querySelectorAll('button'), function (b) {
            var on = voulus.indexOf(b.getAttribute('data-jour')) !== -1;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
          });
        }
      }
    };

    /* Un seul point de sortie : tout changement repasse par ici. */
    function majTout() { clearState(); render(); ecrireURL(); }

    grid.addEventListener('change', majTout);

    /* Le « × » du Studio est un vrai bouton : il remet les rubriques d'origine. */
    if (studioReset) {
      studioReset.addEventListener('click', function () {
        Array.prototype.forEach.call(grid.querySelectorAll('input[name="rubrique"]'), function (i) {
          i.checked = DEFAUTS.indexOf(i.value) !== -1;
        });
        majTout();
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
            dire('Lien copié — il rouvrira ta composition à l’identique.', false);
          }, function () {
            dire('Copie refusée par le navigateur, mais l’adresse de la page contient déjà ta composition.', true);
          });
        } else {
          dire('L’adresse de la page contient ta composition — copie-la depuis la barre d’adresse.', true);
        }
      });
    }

    /* Le bouton n'est jamais pré-désactivé : on laisse envoyer et on répond. */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (cochees().length === 0) {
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

    lireURL();
    render();
  }

  /* ─── L'édition : feuilletage des pages A4 ────────────
     Le défilement à aimantation fait le gros du travail — glissement
     tactile, molette horizontale, et l'aimantation elle-même viennent du
     navigateur. Ce script ne fait que deux choses : dire où l'on en est, et
     offrir des boutons à qui préfère cliquer plutôt que glisser. */
  var stage = document.getElementById('a4Stage');

  if (stage) {
    var feuilles = Array.prototype.slice.call(stage.querySelectorAll('.a4-wrap'));
    var titres = ['La une', 'Messages & Agenda', 'Actualités', 'Marchés & Veille'];
    var aPrev = document.getElementById('a4Prev');
    var aNext = document.getElementById('a4Next');
    var aDots = document.getElementById('a4Dots');
    var aCount = document.getElementById('a4Count');
    var courante = 0;
    var tickingA4 = false;

    var aller = function (i) {
      i = Math.max(0, Math.min(feuilles.length - 1, i));
      feuilles[i].scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest'   /* sans quoi la page entière défilerait aussi */
      });
    };

    var puces = feuilles.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'a4-dot';
      b.setAttribute('aria-label', 'Page ' + (i + 1) + ' sur ' + feuilles.length + ' · ' + titres[i]);
      b.addEventListener('click', function () { aller(i); });
      aDots.appendChild(b);
      return b;
    });

    var majUI = function () {
      puces.forEach(function (d, i) {
        if (i === courante) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      aPrev.disabled = courante === 0;
      aNext.disabled = courante === feuilles.length - 1;
      aCount.textContent = 'Page ' + (courante + 1) + ' sur ' + feuilles.length + ' · ' + titres[courante];
    };

    /* La page courante est celle dont le centre est le plus proche du centre
       du cadre. Plus fiable qu'un seuil de visibilité : à cette largeur, deux
       feuilles peuvent être visibles à plus de moitié en même temps. */
    var mesurer = function () {
      var r = stage.getBoundingClientRect();
      var centre = r.left + r.width / 2;
      var best = 0, bestD = Infinity;
      feuilles.forEach(function (f, i) {
        var fr = f.getBoundingClientRect();
        var d = Math.abs(fr.left + fr.width / 2 - centre);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== courante) { courante = best; majUI(); }
      tickingA4 = false;
    };

    stage.addEventListener('scroll', function () {
      if (tickingA4) return;
      tickingA4 = true;
      window.requestAnimationFrame(mesurer);
    }, { passive: true });

    aPrev.addEventListener('click', function () { aller(courante - 1); });
    aNext.addEventListener('click', function () { aller(courante + 1); });

    stage.addEventListener('keydown', function (e) {
      var to;
      if (e.key === 'ArrowRight') to = courante + 1;
      else if (e.key === 'ArrowLeft') to = courante - 1;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = feuilles.length - 1;
      else return;
      e.preventDefault();
      aller(to);
    });

    majUI();
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
