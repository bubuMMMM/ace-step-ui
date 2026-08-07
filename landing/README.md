# Prédizh — landing page

Clone statique de la landing page Prédizh (jeu de prédictions locales en Bretagne).
Pas de build, pas de dépendances : trois fichiers et un dossier d'assets.

**En ligne :** https://predizh-landing.vercel.app

```
landing/
├── index.html          markup complet de la page
├── styles.css          tous les styles (tokens, sections, responsive)
├── script.js           nav mobile, reveal au scroll, carrousel, compteur, formulaire
├── fonts.css           @font-face des polices auto-hébergées
├── assets/
│   ├── fonts/          Archivo, Inter, Caveat (woff2 variables, OFL 1.1)
│   ├── avatars/        14 portraits vectoriels générés
│   ├── phare.svg       illustration du hero
│   ├── map-bretagne.svg carte pointillée générée
│   └── *.svg           café, surf, crêpe, festival, commerce, calvaire
└── tools/              scripts de (re)génération des assets
```

## Développement

Aucun outillage requis — il suffit de servir le dossier :

```bash
cd landing && python3 -m http.server 8000
```

## Régénérer les assets

```bash
node tools/generate-map.mjs assets/map-bretagne.svg   # carte pointillée
node tools/generate-avatars.mjs assets/avatars        # portraits
```

La carte est construite à partir d'un tracé côtier réel (longitude/latitude),
projeté puis échantillonné sur une grille hexagonale. Le script affiche aussi
les coordonnées en pourcentage des villes, à reporter sur les `.mapdot`
dans `index.html` si le tracé change.

## Notes d'implémentation

- **Aucune ressource externe.** Polices et illustrations sont locales : la page
  se charge intégralement hors ligne et ne dépend d'aucun CDN.
- **Illustrations vectorielles.** Toutes les « photos » sont des SVG écrits à la
  main, donc nets à toute résolution et légers.
- **Polices variables.** Le titre du hero utilise l'axe `wdth` d'Archivo via
  `font-stretch` (et non `font-variation-settings`, qui n'a pas d'effet ici).
- **Robustesse.** Les animations d'apparition sont conditionnées à la classe
  `.js` sur `<html>` : sans JavaScript, tout le contenu reste visible.
  `prefers-reduced-motion` désactive animations et défilement doux.
- **Accessibilité.** Lien d'évitement, navigation au clavier avec `:focus-visible`,
  `aria-*` sur le menu, les onglets et le carrousel, textes alternatifs sur les
  illustrations porteuses de sens.

## Déploiement

Site statique : n'importe quel hébergeur convient. Sur Vercel, pointer la racine
du projet sur `landing/`, sans build command ni framework.

Une seule différence sur https://predizh-landing.vercel.app : les polices y sont
chargées depuis Google Fonts plutôt qu'auto-hébergées, parce que ce déploiement
a été poussé par l'API (qui prend les fichiers en clair, sans binaires). Brancher
ce dépôt sur Vercel redéploie la version auto-hébergée, sans dépendance externe.
Le rendu est identique : mêmes familles, mêmes axes variables.
