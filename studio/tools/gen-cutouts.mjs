/**
 * Generates the alpha-preserving WebP foreground cutouts used by Kage.
 * Everything is drawn procedurally in a headless Chromium 2D canvas —
 * there is no source photography anywhere in this project.
 *
 *   node tools/gen-cutouts.mjs
 */
import { chromium } from 'playwright-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'public', 'sites', 'kage', 'assets', 'img');
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const draw = () => {
  /* ── helpers ──────────────────────────────────────────────────────── */
  const rngOf = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const make = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  const INK = '#070a10';

  /** cold moon rim from above, faint warm bounce from below, then grain */
  function finish(ctx, w, h, opts = {}) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, opts.rim || 'rgba(150,180,235,0.34)');
    g.addColorStop(0.28, 'rgba(60,80,120,0.10)');
    g.addColorStop(0.62, 'rgba(10,14,22,0.00)');
    g.addColorStop(1, opts.warm || 'rgba(226,120,54,0.07)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // grain so the cutouts sit in the same film as the render
    const n = make(180, 180);
    const nx = n.getContext('2d');
    const img = nx.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 74;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 26;
    }
    nx.putImageData(img, 0, 0);
    const pat = ctx.createPattern(n, 'repeat');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  const out = {};
  const emit = (name, canvas, q = 0.82) => { out[name] = canvas.toDataURL('image/webp', q); };

  /* ── grass ────────────────────────────────────────────────────────── */
  {
    const w = 1920, h = 540, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(11);
    // low mass at the base
    x.fillStyle = INK;
    x.beginPath();
    x.moveTo(0, h);
    for (let i = 0; i <= 60; i++) {
      const px = (i / 60) * w;
      const py = h - 42 - Math.sin(i * 0.7) * 12 - r() * 26;
      x.lineTo(px, py);
    }
    x.lineTo(w, h);
    x.closePath();
    x.fill();

    for (let i = 0; i < 1100; i++) {
      const bx = r() * w;
      const depth = r();
      const len = 46 + depth * 210;
      const lean = (r() - 0.5) * 120 * (0.4 + depth);
      x.strokeStyle = INK;
      x.lineWidth = 1.1 + depth * 3.2;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(bx, h - 8);
      x.quadraticCurveTo(bx + lean * 0.35, h - len * 0.62, bx + lean, h - len);
      x.stroke();
      // occasional seed head
      if (r() > 0.94) {
        x.fillStyle = INK;
        x.beginPath();
        x.ellipse(bx + lean, h - len - 6, 2.6 + depth * 3, 9 + depth * 12, lean * 0.004, 0, 6.3);
        x.fill();
      }
    }
    finish(x, w, h, { rim: 'rgba(150,182,238,0.40)' });
    emit('fg-grass', c, 0.7);
  }

  /* ── pine line ────────────────────────────────────────────────────── */
  {
    const w = 1920, h = 540, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(23);
    const tree = (cx, base, height, width) => {
      x.fillStyle = INK;
      x.beginPath();
      x.moveTo(cx - width * 0.06, base);
      x.lineTo(cx - width * 0.06, base - height * 0.22);
      const tiers = 6;
      for (let t = 0; t < tiers; t++) {
        const f = t / tiers;
        const y0 = base - height * (0.22 + f * 0.72);
        const y1 = base - height * (0.22 + (f + 1 / tiers) * 0.72);
        const wide = width * (1 - f) * (0.5 + r() * 0.16);
        x.lineTo(cx - wide, y0 + height * 0.03);
        x.lineTo(cx - wide * 0.42, y0);
        x.lineTo(cx - wide * 0.62, y1 + height * 0.05);
      }
      x.lineTo(cx, base - height);
      for (let t = tiers - 1; t >= 0; t--) {
        const f = t / tiers;
        const y0 = base - height * (0.22 + f * 0.72);
        const y1 = base - height * (0.22 + (f + 1 / tiers) * 0.72);
        const wide = width * (1 - f) * (0.5 + r() * 0.16);
        x.lineTo(cx + wide * 0.62, y1 + height * 0.05);
        x.lineTo(cx + wide * 0.42, y0);
        x.lineTo(cx + wide, y0 + height * 0.03);
      }
      x.lineTo(cx + width * 0.06, base - height * 0.22);
      x.lineTo(cx + width * 0.06, base);
      x.closePath();
      x.fill();
    };
    for (let i = 0; i < 34; i++) {
      const cx = -40 + (i / 33) * (w + 80) + (r() - 0.5) * 46;
      tree(cx, h + 10, 210 + r() * 300, 46 + r() * 62);
    }
    x.fillStyle = INK;
    x.fillRect(0, h - 40, w, 40);
    finish(x, w, h, { rim: 'rgba(140,172,230,0.26)' });
    emit('fg-pines', c, 0.74);
  }

  /* ── hills ────────────────────────────────────────────────────────── */
  {
    const w = 1920, h = 540, c = make(w, h), x = c.getContext('2d');
    const bands = [
      { y: 250, amp: 74, tint: 'rgba(13,19,30,1)', f: 0.0022 },
      { y: 330, amp: 92, tint: 'rgba(9,14,22,1)', f: 0.0031 },
      { y: 420, amp: 66, tint: 'rgba(6,9,15,1)', f: 0.0046 },
    ];
    bands.forEach((b, bi) => {
      x.fillStyle = b.tint;
      x.beginPath();
      x.moveTo(0, h);
      for (let px = 0; px <= w; px += 6) {
        const n = Math.sin(px * b.f + bi * 2.1) * 0.6
          + Math.sin(px * b.f * 2.7 + bi * 5.5) * 0.28
          + Math.sin(px * b.f * 6.1 + bi) * 0.12;
        x.lineTo(px, b.y - n * b.amp);
      }
      x.lineTo(w, h);
      x.closePath();
      x.fill();
    });
    finish(x, w, h, { rim: 'rgba(132,164,224,0.17)', warm: 'rgba(226,120,54,0.05)' });
    emit('fg-hills', c);
  }

  /* ── stones ───────────────────────────────────────────────────────── */
  {
    const w = 1920, h = 540, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(41);
    const rock = (cx, cy, rw, rh) => {
      x.fillStyle = INK;
      x.beginPath();
      const pts = 11;
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const k = 0.74 + r() * 0.42;
        const px = cx + Math.cos(a) * rw * k;
        const py = cy + Math.sin(a) * rh * k * (Math.sin(a) > 0 ? 0.42 : 1);
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath();
      x.fill();
    };
    for (let i = 0; i < 26; i++) {
      const cx = r() * w;
      const s = 0.4 + Math.pow(r(), 1.6) * 1.5;
      rock(cx, h - 20 - r() * 40, 90 * s, 96 * s);
    }
    for (let i = 0; i < 420; i++) {
      x.fillStyle = INK;
      x.beginPath();
      x.ellipse(r() * w, h - r() * 70, 2 + r() * 7, 1.5 + r() * 4, r() * 3, 0, 6.3);
      x.fill();
    }
    x.fillStyle = INK;
    x.fillRect(0, h - 26, w, 26);
    finish(x, w, h, { rim: 'rgba(158,188,240,0.44)' });
    emit('fg-stones', c);
  }

  /* ── bushes ───────────────────────────────────────────────────────── */
  {
    const w = 1920, h = 540, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(59);
    for (let b = 0; b < 17; b++) {
      const cx = -60 + (b / 16) * (w + 120) + (r() - 0.5) * 70;
      const cy = h - 10 - r() * 46;
      const s = 0.6 + r() * 1.15;
      x.fillStyle = INK;
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6);
        const px = cx + Math.cos(a) * 130 * s * d;
        const py = cy - Math.abs(Math.sin(a)) * 108 * s * d;
        x.beginPath();
        x.arc(px, py, (16 + r() * 30) * s, 0, 6.3);
        x.fill();
      }
      // leaf ticks around the edge
      for (let i = 0; i < 60; i++) {
        const a = -r() * Math.PI;
        const px = cx + Math.cos(a) * 138 * s;
        const py = cy + Math.sin(a) * 116 * s;
        x.save();
        x.translate(px, py);
        x.rotate(a + 1.57);
        x.beginPath();
        x.ellipse(0, 0, 4 + r() * 9, 2 + r() * 4, 0, 0, 6.3);
        x.fill();
        x.restore();
      }
    }
    finish(x, w, h, { rim: 'rgba(142,176,232,0.30)' });
    emit('fg-bush', c);
  }

  /* ── temple wall with a tiled cap ─────────────────────────────────── */
  {
    const w = 1920, h = 540, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(73);
    const top = h - 268;
    // plaster body, darkening toward the base
    const bg = x.createLinearGradient(0, top, 0, h);
    bg.addColorStop(0, '#0c111a');
    bg.addColorStop(0.5, '#080b12');
    bg.addColorStop(1, '#05070b');
    x.fillStyle = bg;
    x.fillRect(0, top, w, h - top);
    // timber posts and the horizontal rail between them
    x.fillStyle = '#04060a';
    for (let px = -40; px < w + 40; px += 268) x.fillRect(px + 14, top + 26, 30, h - top);
    x.fillStyle = 'rgba(4,6,10,0.9)';
    x.fillRect(0, top + 132, w, 14);
    // faint plaster seams
    x.strokeStyle = 'rgba(170,196,236,0.045)';
    x.lineWidth = 1.5;
    for (let px = 60; px < w; px += 134) {
      x.beginPath(); x.moveTo(px, top + 32); x.lineTo(px, h - 10); x.stroke();
    }
    // capping course: a continuous ridge of round tile ends
    x.fillStyle = '#070a10';
    x.fillRect(-4, top - 18, w + 8, 34);
    for (let px = -10; px < w + 40; px += 30) {
      x.fillStyle = '#080c13';
      x.beginPath(); x.arc(px, top - 16, 16, Math.PI, 0); x.fill();
      // moonlight catching the crown of each tile
      x.fillStyle = 'rgba(176,204,248,0.16)';
      x.beginPath(); x.arc(px, top - 19, 15, Math.PI * 1.12, Math.PI * 1.72); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.55)';
      x.fillRect(px + 13, top - 30, 4, 26);
    }
    // deep shadow thrown by the cap
    const sg = x.createLinearGradient(0, top + 14, 0, top + 104);
    sg.addColorStop(0, 'rgba(0,0,0,0.9)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sg;
    x.fillRect(0, top + 14, w, 90);
    // grass at the foot
    x.strokeStyle = '#070a10';
    x.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const bx = r() * w, len = 20 + r() * 60;
      x.lineWidth = 1 + r() * 2.4;
      x.beginPath();
      x.moveTo(bx, h);
      x.quadraticCurveTo(bx + (r() - 0.5) * 20, h - len * 0.6, bx + (r() - 0.5) * 42, h - len);
      x.stroke();
    }
    finish(x, w, h, { rim: 'rgba(158,188,240,0.26)', warm: 'rgba(226,120,54,0.05)' });
    emit('fg-wall', c);
  }

  /* ── ruins ────────────────────────────────────────────────────────── */
  {
    const w = 1920, h = 540, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(97);
    // broken wall fragments
    for (let i = 0; i < 9; i++) {
      const bx = 40 + (i / 8) * (w - 120) + (r() - 0.5) * 90;
      const bw = 90 + r() * 210;
      const bh = 70 + r() * 220;
      x.fillStyle = '#080b12';
      x.beginPath();
      x.moveTo(bx, h);
      x.lineTo(bx, h - bh);
      let px = bx;
      while (px < bx + bw) {
        const step = 14 + r() * 30;
        px += step;
        x.lineTo(Math.min(px, bx + bw), h - bh + (r() - 0.5) * 46);
      }
      x.lineTo(bx + bw, h);
      x.closePath();
      x.fill();
    }
    // leaning posts
    for (let i = 0; i < 6; i++) {
      const bx = 120 + r() * (w - 240);
      const bh = 150 + r() * 240;
      x.save();
      x.translate(bx, h);
      x.rotate((r() - 0.5) * 0.34);
      x.fillStyle = '#06080d';
      x.fillRect(-14, -bh, 28, bh);
      x.restore();
    }
    // a fallen beam
    x.save();
    x.translate(w * 0.62, h - 60);
    x.rotate(-0.16);
    x.fillStyle = '#06080d';
    x.fillRect(-320, -22, 640, 34);
    x.restore();
    // rubble
    for (let i = 0; i < 300; i++) {
      x.fillStyle = '#070a10';
      x.beginPath();
      x.ellipse(r() * w, h - r() * 60, 3 + r() * 14, 2 + r() * 8, r() * 3, 0, 6.3);
      x.fill();
    }
    x.fillStyle = '#070a10';
    x.fillRect(0, h - 24, w, 24);
    finish(x, w, h, { rim: 'rgba(150,180,235,0.36)' });
    emit('fg-ruins', c);
  }

  /* ── maple branch ─────────────────────────────────────────────────── */
  {
    const w = 1100, h = 820, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(131);
    const leaf = (px, py, s, rot, fill) => {
      x.save();
      x.translate(px, py);
      x.rotate(rot);
      x.fillStyle = fill;
      x.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.62;
        const rr = s * (i === 2 ? 1 : 0.84);
        x.moveTo(0, 0);
        x.lineTo(Math.cos(a - 0.17) * s * 0.5, Math.sin(a - 0.17) * s * 0.5);
        x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        x.lineTo(Math.cos(a + 0.17) * s * 0.5, Math.sin(a + 0.17) * s * 0.5);
        x.closePath();
      }
      x.fill();
      x.restore();
    };
    const branch = (x0, y0, x1, y1, thick, depth) => {
      x.strokeStyle = '#080a0e';
      x.lineWidth = thick;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(x0, y0);
      const mx = (x0 + x1) / 2 + (r() - 0.5) * 90;
      const my = (y0 + y1) / 2 + (r() - 0.5) * 60;
      x.quadraticCurveTo(mx, my, x1, y1);
      x.stroke();
      if (depth > 0) {
        const n = 2 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) {
          const t = 0.35 + r() * 0.6;
          const bx = x0 + (x1 - x0) * t + (r() - 0.5) * 40;
          const by = y0 + (y1 - y0) * t + (r() - 0.5) * 30;
          branch(bx, by, bx + (r() - 0.2) * 240, by - r() * 200, thick * 0.6, depth - 1);
        }
      } else {
        for (let i = 0; i < 9; i++) {
          const t = r();
          const lx = x0 + (x1 - x0) * t + (r() - 0.5) * 46;
          const ly = y0 + (y1 - y0) * t + (r() - 0.5) * 40;
          const tone = r();
          const fill = tone > 0.86 ? 'rgba(150,52,28,0.95)'
            : tone > 0.6 ? 'rgba(96,32,20,0.95)'
              : 'rgba(38,14,12,0.96)';
          leaf(lx, ly, 15 + r() * 26, r() * 6.3, fill);
        }
      }
    };
    branch(-30, h + 40, 430, h - 250, 34, 2);
    branch(30, h + 20, 720, h - 470, 26, 2);
    branch(-10, h - 60, 300, h - 560, 18, 2);
    finish(x, w, h, { rim: 'rgba(158,186,240,0.24)', warm: 'rgba(255,140,60,0.16)' });
    emit('fg-maple', c, 0.84);
  }

  /* ── sakura branch ────────────────────────────────────────────────── */
  {
    const w = 1100, h = 820, c = make(w, h), x = c.getContext('2d');
    const r = rngOf(151);
    const blossom = (px, py, s, alpha) => {
      x.save();
      x.translate(px, py);
      x.rotate(r() * 6.3);
      for (let i = 0; i < 5; i++) {
        x.rotate(1.2566);
        x.fillStyle = `rgba(232,214,206,${alpha})`;
        x.beginPath();
        x.ellipse(0, -s * 0.66, s * 0.42, s * 0.66, 0, 0, 6.3);
        x.fill();
      }
      x.fillStyle = `rgba(120,66,58,${alpha})`;
      x.beginPath();
      x.arc(0, 0, s * 0.2, 0, 6.3);
      x.fill();
      x.restore();
    };
    const branch = (x0, y0, x1, y1, thick, depth) => {
      x.strokeStyle = '#070a0f';
      x.lineWidth = thick;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(x0, y0);
      x.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 110, (y0 + y1) / 2 + (r() - 0.5) * 70, x1, y1);
      x.stroke();
      if (depth > 0) {
        for (let i = 0; i < 3; i++) {
          const t = 0.3 + r() * 0.65;
          const bx = x0 + (x1 - x0) * t;
          const by = y0 + (y1 - y0) * t;
          branch(bx, by, bx - r() * 250, by - r() * 210, thick * 0.58, depth - 1);
        }
      } else {
        for (let i = 0; i < 13; i++) {
          const t = r();
          blossom(x0 + (x1 - x0) * t + (r() - 0.5) * 50,
            y0 + (y1 - y0) * t + (r() - 0.5) * 44,
            7 + r() * 12, 0.55 + r() * 0.4);
        }
      }
    };
    branch(w + 30, h + 40, w - 430, h - 240, 32, 2);
    branch(w - 20, h + 10, w - 760, h - 450, 24, 2);
    branch(w + 10, h - 70, w - 320, h - 560, 16, 2);
    // a few petals adrift
    for (let i = 0; i < 30; i++) blossom(r() * w, r() * h, 4 + r() * 6, 0.22 + r() * 0.3);
    finish(x, w, h, { rim: 'rgba(170,196,244,0.22)', warm: 'rgba(255,160,90,0.12)' });
    emit('fg-sakura', c, 0.74);
  }

  /* ── stone lantern ────────────────────────────────────────────────── */
  {
    const w = 640, h = 980, c = make(w, h), x = c.getContext('2d');
    const cx = w / 2;
    const poly = (pts) => {
      x.beginPath();
      pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
      x.closePath();
      x.fill();
    };
    x.fillStyle = '#0a0d14';
    // base
    poly([[cx - 150, h], [cx + 150, h], [cx + 120, h - 70], [cx - 120, h - 70]]);
    poly([[cx - 128, h - 70], [cx + 128, h - 70], [cx + 96, h - 118], [cx - 96, h - 118]]);
    // shaft
    poly([[cx - 44, h - 118], [cx + 44, h - 118], [cx + 38, h - 400], [cx - 38, h - 400]]);
    // mid platform
    poly([[cx - 118, h - 400], [cx + 118, h - 400], [cx + 96, h - 452], [cx - 96, h - 452]]);
    // fire box
    poly([[cx - 104, h - 452], [cx + 104, h - 452], [cx + 104, h - 606], [cx - 104, h - 606]]);
    // roof with lifted corners
    x.beginPath();
    x.moveTo(cx - 196, h - 606);
    x.quadraticCurveTo(cx - 150, h - 640, cx - 96, h - 662);
    x.lineTo(cx, h - 700);
    x.lineTo(cx + 96, h - 662);
    x.quadraticCurveTo(cx + 150, h - 640, cx + 196, h - 606);
    x.quadraticCurveTo(cx + 120, h - 622, cx, h - 624);
    x.quadraticCurveTo(cx - 120, h - 622, cx - 196, h - 606);
    x.closePath();
    x.fill();
    // finial
    x.beginPath();
    x.arc(cx, h - 716, 22, 0, 6.3);
    x.fill();
    x.fillRect(cx - 7, h - 716, 14, 26);

    finish(x, w, h, { rim: 'rgba(160,190,242,0.40)', warm: 'rgba(255,150,70,0.18)' });

    // the flame window is added after the rim pass so it stays warm
    const g = x.createRadialGradient(cx, h - 528, 4, cx, h - 528, 190);
    g.addColorStop(0, 'rgba(255,232,190,0.98)');
    g.addColorStop(0.12, 'rgba(255,196,120,0.72)');
    g.addColorStop(0.4, 'rgba(255,150,70,0.20)');
    g.addColorStop(1, 'rgba(255,140,60,0)');
    x.fillStyle = g;
    x.fillRect(cx - 200, h - 728, 400, 400);
    x.fillStyle = 'rgba(255,226,180,0.95)';
    x.fillRect(cx - 58, h - 574, 116, 92);
    x.fillStyle = 'rgba(10,12,18,0.9)';
    for (let i = -2; i <= 2; i++) x.fillRect(cx + i * 23 - 2, h - 574, 4, 92);
    x.fillRect(cx - 58, h - 534, 116, 4);
    emit('fg-lantern', c, 0.86);
  }

  return out;
};

/* ── run ──────────────────────────────────────────────────────────────── */
const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
await page.setContent('<!doctype html><meta charset=utf-8><title>gen</title>');
const result = await page.evaluate(draw);
await browser.close();

await mkdir(outDir, { recursive: true });
let total = 0;
for (const [name, dataUrl] of Object.entries(result)) {
  const b64 = dataUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  await writeFile(join(outDir, `${name}.webp`), buf);
  total += buf.length;
  console.log(`${name}.webp  ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log(`— ${Object.keys(result).length} cutouts, ${(total / 1024).toFixed(0)} KB total`);
