# Morning Paper — landing page

Landing page statique (HTML / CSS / JS vanilla, sans build) pour **Morning Paper** :
ton édition personnelle, imprimée chez toi chaque matin à 07:00.

## Contenu

```
landing/
├── index.html   # la page complète (une seule route)
├── styles.css   # design system + toutes les sections
├── script.js    # menu mobile, apparitions, composer, FAQ, inscription
└── vercel.json  # cleanUrls + en-têtes de sécurité
```

Aucune image : le visuel du héros et l’illustration « à la une » sont des SVG
inline. La page ne charge donc qu’une seule ressource externe, les polices
Google Fonts.

## Sections

1. **Héros** — « Ta journée, imprimée avant ton réveil. » + preuves rapides
2. **Bandeau défilant** — édition du jour en un coup d’œil
3. **Le concept** — comparaison « sans » / « avec »
4. **L’édition** — une vraie une de journal reconstruite en HTML/CSS
5. **Composer** — sélecteur de rubriques + nombre de pages, aperçu en direct
6. **Comment ça marche** — 3 étapes
7. **Tarifs** — offre fondateur 19€/mois, tampon 30 jours
8. **FAQ** — accordéon
9. **CTA final** — inscription e-mail (validation côté client)

## Design

| Rôle | Valeur |
| --- | --- |
| Papier | `#F7F3E9` |
| Encre | `#16150F` |
| Surligneur | `#D8DE4D` |
| Titres | Playfair Display |
| Textes | Inter |

Accessibilité : structure sémantique, `aria` sur le menu, l’accordéon et le
sélecteur de pages, focus visibles, contrastes AA, `prefers-reduced-motion`
respecté. Une feuille d’impression masque le chrome de la page.

## Développement

Aucune dépendance, aucun build :

```bash
cd landing
python3 -m http.server 4173
# → http://localhost:4173
```

## Déploiement

En production sur Vercel : **https://morning-paper-one.vercel.app**
(projet `morning-paper`, équipe `bubummmms-projects`).

Site statique servi tel quel — aucun framework, aucune commande de build. Pour
brancher le déploiement continu sur ce dépôt, importer le projet depuis GitHub
avec `Root Directory` = `landing`.
