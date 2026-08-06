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
      'Finance': 2, 'Sport': 2, 'Focus du jour': 2, 'Veille & IA': 3,
      'Ma to-do': 3, 'Culture': 2, 'Sciences': 2, 'Citation du jour': 1
    };
    var DEFAUTS = ['À la une', 'Focus du jour', 'Agenda', 'Messages', 'Actualités', 'Météo'];
    var ORDRE = ['l', 'm', 'e', 'j', 'v', 's', 'd'];
    var NOMS = { l:'lundi', m:'mardi', e:'mercredi', j:'jeudi', v:'vendredi', s:'samedi', d:'dimanche' };

    /* Réglages propres à chaque rubrique. Toute l'interface d'affinage est
       engendrée à partir d'ici : ajouter une option, c'est ajouter une ligne.
       « seg » = choix unique, « chips » = choix multiple. Les valeurs sont
       stockées et transmises par leur indice, jamais par leur libellé —
       l'URL reste ainsi courte et insensible aux accents. */
    var OPTIONS = {
      une: [
        { k:'n', nom:'Articles à la une', type:'seg', val:['1','2','3'], def:1, suf:'article' },
        { k:'p', nom:'Illustration', type:'seg', val:['Avec photo','Sans photo'], def:0 },
        { k:'e', nom:'Encadré', type:'seg', val:['Aucun','Le chiffre du jour','La phrase du jour'], def:1 }
      ],
      focus: [
        { k:'s', nom:'D’où vient le focus', type:'seg', val:['Je le choisis','Depuis l’agenda','Depuis la to-do'], def:0 },
        { k:'c', nom:'Ce qu’il contient', type:'chips', val:['Objectif','Préparation','Points de vigilance','Contacts utiles'], def:[0,1] },
        { k:'t', nom:'Ton', type:'seg', val:['Factuel','Encourageant'], def:0 }
      ],
      agenda: [
        { k:'c', nom:'Calendriers', type:'chips', val:['Perso','Pro','Famille','Anniversaires'], def:[0,1] },
        { k:'h', nom:'Plage horaire', type:'seg', val:['Journée','Jusqu’à 18 h','24 h'], def:0 },
        { k:'d', nom:'Détails affichés', type:'chips', val:['Lieu','Participants','Trajet','Notes'], def:[0,2] }
      ],
      msg: [
        { k:'s', nom:'Sources', type:'chips', val:['WhatsApp','Gmail','Slack','LinkedIn','SMS'], def:[0,1] },
        { k:'f', nom:'Filtre', type:'seg', val:['Tout','Importants seulement'], def:1 },
        { k:'r', nom:'Mise en forme', type:'seg', val:['Liste','Groupé par expéditeur'], def:0 }
      ],
      todo: [
        { k:'s', nom:'Source', type:'seg', val:['Notion','Todoist','Rappels'], def:0 },
        { k:'n', nom:'Tâches affichées', type:'seg', val:['3','5','8'], def:1, suf:'tâche' },
        { k:'t', nom:'Tri', type:'seg', val:['Par échéance','Par priorité','Par projet'], def:0 },
        { k:'c', nom:'Cases à cocher', type:'seg', val:['Imprimées','Sans'], def:0 }
      ],
      actus: [
        { k:'t', nom:'Thèmes', type:'chips', val:['France','Monde','Économie','Tech','Culture','Sciences'], def:[0,1,3] },
        { k:'s', nom:'Sources', type:'chips', val:['AFP','Le Monde','Reuters','France Info','Courrier international'], def:[0,1] },
        { k:'n', nom:'Articles', type:'seg', val:['3','5','8'], def:1, suf:'article' },
        { k:'g', nom:'Traitement', type:'seg', val:['Factuel','Avec analyses'], def:0 }
      ],
      meteo: [
        { k:'l', nom:'Lieux', type:'chips', val:['Domicile','Bureau','Week-end'], def:[0] },
        { k:'d', nom:'Détail', type:'seg', val:['Résumé','Heure par heure'], def:0 },
        { k:'a', nom:'En complément', type:'chips', val:['Qualité de l’air','Alertes','Éphéméride','Pollens'], def:[1] }
      ],
      finance: [
        { k:'i', nom:'À suivre', type:'chips', val:['CAC 40','Nasdaq','S&P 500','Or','Brent','Crypto'], def:[0,1] },
        { k:'v', nom:'Variation', type:'seg', val:['Sur la journée','Sur la semaine','Depuis janvier'], def:0 },
        { k:'p', nom:'Ton portefeuille', type:'seg', val:['Affiché','Masqué'], def:1 }
      ],
      sport: [
        { k:'s', nom:'Disciplines', type:'chips', val:['Football','Rugby','Tennis','Cyclisme','Basket','F1'], def:[0] },
        { k:'c', nom:'Compétitions', type:'chips', val:['Championnat','Coupes','International'], def:[0,2] },
        { k:'r', nom:'Contenu', type:'seg', val:['Résultats','Résultats et analyses'], def:0 }
      ],
      culture: [
        { k:'d', nom:'Domaines', type:'chips', val:['Cinéma','Musique','Livres','Expositions','Séries'], def:[0,2] },
        { k:'f', nom:'Angle', type:'chips', val:['Critiques','Sorties de la semaine','Agenda près de chez toi'], def:[0,1] },
        { k:'n', nom:'Recommandations', type:'seg', val:['1','2','4'], def:1, suf:'reco' }
      ],
      sciences: [
        { k:'d', nom:'Domaines', type:'chips', val:['Espace','Santé','Climat','Numérique','Biologie'], def:[0,2] },
        { k:'n', nom:'Niveau', type:'seg', val:['Vulgarisé','Détaillé'], def:0 }
      ],
      ia: [
        { k:'d', nom:'Domaines', type:'chips', val:['Modèles','Produits','Recherche','Régulation'], def:[1] },
        { k:'v', nom:'Volume', type:'seg', val:['3 liens','5 liens','10 liens'], def:0 },
        { k:'f', nom:'Format', type:'seg', val:['Titres seuls','Titres et résumés'], def:1 }
      ],
      citation: [
        { k:'r', nom:'Registre', type:'chips', val:['Philosophie','Littérature','Sciences','Sport'], def:[1] },
        { k:'l', nom:'Langue', type:'seg', val:['Français','Version originale'], def:0 }
      ]
    };

    var etat = { pages:8, format:'A4', verso:1, heure:'07:00', jours:['l','m','e','j','v'], opts:{} };
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

    /* ─── L'état fin, par rubrique ────────────────────────
       Seul ce qui s'écarte du réglage d'origine est retenu : etat.opts ne
       contient que les écarts, ce qui rend « est-ce affiné ? » lisible
       d'un coup d'œil, ici comme dans l'URL. */
    var valeurDe = function (rk, champ) {
      var o = etat.opts[rk];
      if (o && Object.prototype.hasOwnProperty.call(o, champ.k)) return o[champ.k];
      return champ.type === 'chips' ? champ.def.slice() : champ.def;
    };

    var estDefaut = function (rk, champ) {
      var v = valeurDe(rk, champ);
      if (champ.type === 'chips') {
        return v.length === champ.def.length && v.every(function (x) { return champ.def.indexOf(x) !== -1; });
      }
      return v === champ.def;
    };

    var poserValeur = function (rk, champ, v) {
      if (!etat.opts[rk]) etat.opts[rk] = {};
      etat.opts[rk][champ.k] = v;
      if (estDefaut(rk, champ)) {
        delete etat.opts[rk][champ.k];
        if (!Object.keys(etat.opts[rk]).length) delete etat.opts[rk];
      }
    };

    var resumeDe = function (rk) {
      var champs = OPTIONS[rk] || [];
      var bouts = [];
      champs.forEach(function (c) {
        var v = valeurDe(rk, c);
        if (c.type === 'chips') {
          if (!v.length) bouts.push('aucun ' + c.nom.toLowerCase());
          else if (v.length > 2) bouts.push(v.length + ' ' + c.nom.toLowerCase());
          else bouts.push(v.map(function (i) { return c.val[i]; }).join(', '));
        } else if (c.suf) {
          /* « 5 » seul ne dit rien : on rend l'unité au nombre. */
          bouts.push(pluriel(Number(c.val[v]), c.suf));
        } else {
          bouts.push(c.val[v]);
        }
      });
      return bouts.join(' · ');
    };

    /* Le réglage qui compte des éléments, s'il existe : c'est lui qui donne
       sa hauteur au bloc dans l'aperçu. */
    var nombreDe = function (rk) {
      var trouve = 0;
      (OPTIONS[rk] || []).forEach(function (c) {
        if (c.suf) trouve = Number(c.val[valeurDe(rk, c)]);
      });
      return trouve;
    };

    var render = function () {
      var choisies = cochees();

      blocks.innerHTML = '';
      choisies.slice(0, 6).forEach(function (input, index) {
        var nom = input.value;
        var rk = input.getAttribute('data-k');
        var li = document.createElement('li');
        li.style.animationDelay = (index * 45) + 'ms';
        var label = document.createElement('span');
        label.className = 'pb-name';
        label.textContent = nom;
        li.appendChild(label);

        /* L'affinage se voit dans l'aperçu : le résumé sous le titre, et la
           hauteur du bloc suit le nombre d'éléments demandé. */
        if (etat.opts[rk]) {
          var fin = document.createElement('span');
          fin.className = 'pb-fin';
          fin.textContent = resumeDe(rk);
          li.appendChild(fin);
        }

        var n = nombreDe(rk) || LIGNES[nom] || 2;
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

      /* Le Studio porte la marque des rubriques qu'on a réglées, pour les
         retrouver sans redescendre dans la liste. */
      Array.prototype.forEach.call(grid.querySelectorAll('input[name="rubrique"]'), function (i) {
        i.parentElement.classList.toggle(
          'is-fin', i.checked && !!etat.opts[i.getAttribute('data-k')]);
      });

      empty.hidden = choisies.length > 0;
      badge.textContent = etat.pages + (etat.pages > 1 ? ' pages' : ' page');
      foot.textContent = pluriel(choisies.length, 'rubrique') + ' · ' +
        pluriel(etat.pages, 'page') + ' · noir & blanc';

      var r = document.getElementById('recapRub');
      var f = document.getElementById('recapFmt');
      var v = document.getElementById('recapLiv');
      var e = document.getElementById('recapEncre');
      var affinees = Object.keys(etat.opts).length;
      if (r) r.textContent = !choisies.length ? 'Aucune rubrique choisie'
        : pluriel(choisies.length, 'rubrique') + (affinees ? ' · ' + affinees + ' affinée' + (affinees > 1 ? 's' : '') : '');
      if (f) f.textContent = pluriel(etat.pages, 'page') + ' ' + etat.format + (etat.verso ? ' recto-verso' : ' recto');
      if (v) v.textContent = libelleJours() + ' à ' + etat.heure;
      if (e) e.textContent = 'Noir & blanc · ≈ ' + coutMensuel().toString().replace('.', ',') + '€ par mois';
      if (joursNote) {
        joursNote.textContent = libelleJours() + '. ' +
          (etat.jours.length === 7 ? 'Y compris le week-end.' : 'Aucune impression les autres jours.');
      }
    };

    /* ─── Affinage par rubrique ─────────────────────────
       Un <details> par rubrique retenue, replié. Le résumé affiché dans
       l'en-tête reprend les réglages en cours, pour se relire sans déplier. */
    var affineList = document.getElementById('affineList');
    var affineNote = document.getElementById('affineNote');
    /* Les rubriques présentes au rendu précédent. Celles qui apparaissent
       s'ouvrent d'elles-mêmes : cocher un intérêt, c'est demander à le
       régler. « null » vaut premier rendu — on n'ouvre alors rien. */
    var connues = null;

    var champChips = function (rk, champ) {
      var box = document.createElement('div');
      box.className = 'aff-chips';
      champ.val.forEach(function (lib, i) {
        var b = document.createElement('button');
        b.type = 'button';
        var actif = valeurDe(rk, champ).indexOf(i) !== -1;
        b.className = actif ? 'is-on' : '';
        b.setAttribute('aria-pressed', String(actif));
        b.textContent = lib;
        b.addEventListener('click', function () {
          var v = valeurDe(rk, champ).slice();
          var j = v.indexOf(i);
          if (j === -1) v.push(i);
          else if (v.length > 1) v.splice(j, 1);
          else return;   /* on ne vide pas complètement un choix multiple */
          v.sort(function (a, b2) { return a - b2; });
          poserValeur(rk, champ, v);
          majTout();
        });
        box.appendChild(b);
      });
      return box;
    };

    var champSeg = function (rk, champ) {
      var box = document.createElement('div');
      box.className = 'aff-seg';
      box.style.gridTemplateColumns = 'repeat(' + champ.val.length + ',minmax(0,1fr))';
      box.setAttribute('role', 'radiogroup');
      box.setAttribute('aria-label', champ.nom);
      var actuel = valeurDe(rk, champ);
      champ.val.forEach(function (lib, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(i === actuel));
        b.className = i === actuel ? 'is-on' : '';
        b.tabIndex = i === actuel ? 0 : -1;
        b.textContent = lib;
        b.addEventListener('click', function () { poserValeur(rk, champ, i); majTout(); });
        box.appendChild(b);
      });
      return box;
    };

    var renderAffine = function () {
      if (!affineList) return;
      var choisies = cochees();
      var ouvertes = {};
      Array.prototype.forEach.call(affineList.querySelectorAll('details[data-rk]'), function (d) {
        if (d.open) ouvertes[d.getAttribute('data-rk')] = true;
      });
      affineList.innerHTML = '';

      var actuelles = choisies.map(function (i) { return i.getAttribute('data-k'); });
      var nouvelles = connues
        ? actuelles.filter(function (k) { return connues.indexOf(k) === -1; })
        : [];
      connues = actuelles;

      if (!choisies.length) {
        var vide = document.createElement('p');
        vide.className = 'affine-vide';
        vide.textContent = 'Coche une rubrique pour ouvrir ses réglages.';
        affineList.appendChild(vide);
        if (affineNote) affineNote.textContent = '';
        return;
      }

      choisies.forEach(function (input) {
        var rk = input.getAttribute('data-k');
        var champs = OPTIONS[rk];
        if (!champs) return;

        var d = document.createElement('details');
        d.className = 'aff';
        d.setAttribute('data-rk', rk);
        if (ouvertes[rk] || nouvelles.indexOf(rk) !== -1) d.open = true;

        var sum = document.createElement('summary');
        var ico = input.parentElement.querySelector('.rub-ico');
        if (ico) {
          var c = ico.cloneNode(true);
          c.setAttribute('class', 'aff-ico');
          sum.appendChild(c);
        }
        var nom = document.createElement('span');
        nom.className = 'aff-nom';
        nom.textContent = input.value;
        sum.appendChild(nom);

        var res = document.createElement('span');
        res.className = 'aff-resume';
        res.textContent = resumeDe(rk);
        sum.appendChild(res);

        var chev = document.createElement('span');
        chev.className = 'chev';
        chev.setAttribute('aria-hidden', 'true');
        sum.appendChild(chev);
        d.appendChild(sum);

        var body = document.createElement('div');
        body.className = 'aff-body';
        champs.forEach(function (champ) {
          var f = document.createElement('fieldset');
          f.className = 'aff-champ' + (champ.type === 'chips' ? ' aff-champ--wide' : '');
          var lg = document.createElement('legend');
          lg.textContent = champ.nom;
          f.appendChild(lg);
          f.appendChild(champ.type === 'chips' ? champChips(rk, champ) : champSeg(rk, champ));
          body.appendChild(f);
        });

        if (etat.opts[rk]) {
          var raz = document.createElement('button');
          raz.type = 'button';
          raz.className = 'aff-reset';
          raz.textContent = 'Revenir aux réglages par défaut';
          raz.addEventListener('click', function () { delete etat.opts[rk]; majTout(); });
          body.appendChild(raz);
        }

        d.appendChild(body);
        affineList.appendChild(d);
      });

      if (affineNote) {
        var n = Object.keys(etat.opts).length;
        affineNote.textContent = n
          ? pluriel(n, 'rubrique') + ' affinée' + (n > 1 ? 's' : '') + ' sur ' + choisies.length + '.'
          : 'Toutes au réglage par défaut. Déplie une rubrique pour l’ajuster.';
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

      /* Réglages fins : seuls ceux qui s'écartent du défaut voyagent, et
         par indices — « actus~t0-1-3.n2!meteo~d1 » reste lisible et court. */
      var fins = Object.keys(etat.opts).map(function (rk) {
        var champs = etat.opts[rk];
        return rk + '~' + Object.keys(champs).map(function (ck) {
          var v = champs[ck];
          return ck + (Array.isArray(v) ? v.join('-') : v);
        }).join('.');
      });
      if (fins.length) q.set('o', fins.join('!')); else q.delete('o');
      history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
    };

    var lireURL = function () {
      var q = new URLSearchParams(location.search);
      var r = q.get('r');
      if (r !== null) {
        /* On tolère un suffixe hérité (« une-l ») : des liens ont pu être
           partagés avant le retrait du dosage, autant qu'ils continuent
           d'ouvrir la bonne sélection. */
        var voulues = (r ? r.split('.') : []).map(function (part) { return part.split('-')[0]; });
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

      /* Lecture stricte : toute rubrique, tout champ ou tout indice inconnu
         est ignoré plutôt que de faire échouer la restauration. */
      etat.opts = {};
      var o = q.get('o');
      if (o) {
        o.split('!').forEach(function (part) {
          var m = part.split('~');
          var champs = OPTIONS[m[0]];
          if (!champs || !m[1]) return;
          m[1].split('.').forEach(function (bout) {
            var ck = bout.charAt(0), brut = bout.slice(1);
            var champ = null;
            champs.forEach(function (c) { if (c.k === ck) champ = c; });
            if (!champ || !brut) return;
            if (champ.type === 'chips') {
              var idx = brut.split('-').map(Number).filter(function (i) { return i >= 0 && i < champ.val.length; });
              if (idx.length) poserValeur(m[0], champ, idx.sort(function (a, b2) { return a - b2; }));
            } else {
              var i = Number(brut);
              if (i >= 0 && i < champ.val.length) poserValeur(m[0], champ, i);
            }
          });
        });
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
    function majTout() { clearState(); render(); renderAffine(); ecrireURL(); }

    grid.addEventListener('change', majTout);

    /* Le « × » du Studio est un vrai bouton : il remet les rubriques d'origine. */
    if (studioReset) {
      studioReset.addEventListener('click', function () {
        Array.prototype.forEach.call(grid.querySelectorAll('input[name="rubrique"]'), function (i) {
          i.checked = DEFAUTS.indexOf(i.value) !== -1;
        });
        etat.opts = {};
        connues = null;   /* remettre à zéro ne doit rien déplier */
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
    renderAffine();
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
