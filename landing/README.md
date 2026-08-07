# Prédizh — landing page

Clone en HTML/CSS/JS des 4 visuels de campagne Prédizh, fusionnés en une seule page.

## Lancer

Aucune étape de build. Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```sh
python3 -m http.server -d landing 8000   # http://localhost:8000
```

Se déploie tel quel sur n'importe quel hébergeur statique (Vercel, Netlify, GitHub Pages…).

## Fichiers

| Fichier      | Rôle                                                        |
| ------------ | ----------------------------------------------------------- |
| `index.html` | Page complète — CSS et JS inline, icônes en sprite SVG       |
| `fonts.css`  | Anton + Inter (subset latin) en base64 — aucune requête tierce |

## Structure

Chaque visuel de campagne devient une section :

1. **Hero** — « Prédis ce qui arrive près de chez toi. » + mockup du fil de prédictions
2. **`#jeu`** — « L'actu devient un jeu. » + cartes LIVE en collage
3. **`#classement`** — « Prouve que t'as raison. » + Top Bretagne (bascule Bretagne / Amis)
4. **`#recompenses`** — « Prédis. Gagne. Profite. » + tickets de récompenses locales
5. **CTA + footer**

## Choix d'implémentation

- **Typo** : Anton pour les titres, Inter pour l'UI. Les 4 visuels mélangent deux graisses
  display ; la page n'en garde qu'une pour rester cohérente sur un seul scroll.
- **Polices auto-hébergées** (~88 Ko) plutôt que Google Fonts : pas de FOUT sur un design
  où la typo condensée *est* l'identité, et pas de dépendance réseau tierce.
  Subset latin uniquement — tout le français y tient (U+0000–00FF + ponctuation U+2000–206F).
  Un caractère hors de cette plage retomberait sur la police système.
- **Interlignage 0.96** : Anton a de grandes ascendantes, en dessous de ~0.95 les accents
  (`É`, `È`) heurtent la ligne du dessus.
- **Mockups d'iPhone et pierres de granit en CSS/SVG**, pas en images : le granit est un
  `feTurbulence` filtré sur les faces du menhir.
- **Ponctuation française** : espaces insécables avant `?` et `:`, séparateur de milliers
  insécable (`24 875`).
- **Accessibilité** : `prefers-reduced-motion` neutralise reveals et compteurs, le menu
  mobile gère `aria-expanded` et le verrou de scroll, les décors sont `aria-hidden`.

## Contenu

Marque, chiffres, classements et récompenses sont fictifs — repris ou extrapolés des visuels.
