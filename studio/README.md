# PRISME — a library of landing pages

A small, self-contained static site: an index that catalogues five complete landing
pages, and the five pages themselves. No framework, no bundler, no trackers, no
remote requests. The only runtime dependency anywhere is three.js, served from the
site's own origin.

```
studio/
├── public/                      ← the deployable site (this is the output directory)
│   ├── index.html               ← the library index
│   ├── assets/{css,js,img}      ← index styles, filtering script, card thumbnails
│   └── sites/
│       ├── kage/                ← flagship: five-chapter WebGL night walk
│       │   ├── assets/{css,js,img,font}
│       │   └── vendor/          ← three.module.min.js + three.core.min.js
│       ├── halo/                ← SaaS / developer product
│       ├── atelier-noir/        ← fashion editorial (light)
│       ├── signal-lost/         ← 404 utility page
│       └── meridian/            ← wellness programme
├── scripts/
│   ├── vendor.mjs               ← the only build step: copies three.js into public/
│   └── serve.mjs                ← local static server
└── tools/                       ← asset generation and verification (dev only)
    ├── gen-cutouts.mjs          ← draws the alpha WebP foreground cutouts
    ├── shots.mjs                ← renders the cinematic stills from the live scene
    ├── thumbs.mjs               ← screenshots each page for the library cards
    ├── contact-sheet.mjs        ← reviews generated cutouts over a night background
    ├── check.mjs                ← console errors, failed requests, 404s, screenshots
    └── interact.mjs             ← end-to-end interaction suite (30 checks)
```

## Run it locally

```bash
npm install          # only needed to refresh the vendored three.js
npm run build        # copies three.js into public/sites/kage/vendor/
npm run dev          # http://localhost:4173
```

`public/` is a plain static directory — any file server will do, and every path in
it is relative, so it also works from a subfolder (GitHub Pages project sites
included) without configuration.

## Deploying

The site needs no build beyond `scripts/vendor.mjs`, which only copies two files.

| Setting          | Value                     |
| ---------------- | ------------------------- |
| Framework        | Other / none              |
| Root directory   | `studio`                  |
| Build command    | `node scripts/vendor.mjs` |
| Output directory | `public`                  |
| Install command  | `npm install`             |

The vendored three.js files are committed, so the build works even if the install
step is skipped.

## Where the images come from

Nothing here is stock photography and nothing is a placeholder.

- **Foreground cutouts** (`sites/kage/assets/img/fg-*.webp`) — grass, pines, hills,
  stones, bushes, a wall, ruins, a maple branch, a sakura branch and a stone
  lantern — are drawn procedurally on a 2D canvas and exported as alpha-preserving
  WebP by `tools/gen-cutouts.mjs`.
- **Cinematic stills** (`sites/kage/assets/img/still-*.webp`) are frames captured
  from Kage's own 3D scene at each chapter's composed camera position, by
  `tools/shots.mjs`.
- **Library thumbnails** (`assets/img/thumbs/*.webp`) are screenshots of the real
  pages, by `tools/thumbs.mjs`.

Regenerating them needs a Chromium binary:

```bash
node tools/gen-cutouts.mjs
node scripts/serve.mjs 4173 &        # shots and thumbs render the live pages
node tools/shots.mjs
node tools/thumbs.mjs
```

The Japanese display face is a 6 KB subset of Noto Serif JP containing only the
27 glyphs the site actually sets; its SIL Open Font License is alongside it in
`sites/kage/assets/font/`.

## Verifying

```bash
node tools/check.mjs http://localhost:4173/sites/kage/index.html /tmp/kage scroll
node tools/interact.mjs
```

`check.mjs` reports page errors, console errors, failed requests and any response
≥ 400, and writes desktop plus 390×844 screenshots. `interact.mjs` drives the real
interactions: library search, category filters, sort, copy-link, mobile drawers,
Kage's anchor navigation, chapter-rail state, foreground layer handoff, the card
playback control, and the reduced-motion path.

## Notes

Every brand, product, person and place in these pages is invented. Kage's temple,
its coordinates and its two hundred steps do not exist.
