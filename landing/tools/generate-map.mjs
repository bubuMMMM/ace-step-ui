// Generates a dotted map of Bretagne (administrative region) as an SVG.
// Coast outline sampled from real lon/lat, projected to a 600x420 viewBox.

const LON0 = -5.25, LON1 = -1.05;
const LAT0 = 48.95, LAT1 = 47.20;
const W = 600, H = 420;

const px = (lon) => ((lon - LON0) / (LON1 - LON0)) * W;
const py = (lat) => ((LAT0 - lat) / (LAT0 - LAT1)) * H;

// Clockwise from the north-east corner (Baie du Mont-Saint-Michel).
const coast = [
  [-1.55, 48.62], [-1.78, 48.61], [-1.98, 48.68], [-2.13, 48.60], [-2.32, 48.69],
  [-2.48, 48.62], [-2.65, 48.57], [-2.83, 48.59], [-2.96, 48.71], [-3.08, 48.79],
  [-3.24, 48.73], [-3.40, 48.83], [-3.54, 48.73], [-3.63, 48.79], [-3.80, 48.72],
  [-3.96, 48.75], [-4.10, 48.68], [-4.28, 48.68], [-4.42, 48.61], [-4.56, 48.55],
  [-4.72, 48.51], [-4.66, 48.44], [-4.78, 48.36], [-4.72, 48.30], [-4.56, 48.34],
  [-4.42, 48.31], [-4.32, 48.29], [-4.44, 48.24], [-4.62, 48.24], [-4.60, 48.17],
  [-4.42, 48.15], [-4.28, 48.10], [-4.38, 48.04], [-4.58, 48.03], [-4.74, 48.04],
  [-4.66, 47.94], [-4.50, 47.88], [-4.37, 47.79], [-4.24, 47.83], [-4.10, 47.87],
  [-3.96, 47.84], [-3.84, 47.79], [-3.68, 47.76], [-3.54, 47.73], [-3.40, 47.71],
  [-3.28, 47.62], [-3.14, 47.48], [-3.08, 47.56], [-3.00, 47.63], [-2.86, 47.59],
  [-2.74, 47.63], [-2.60, 47.52], [-2.46, 47.50], [-2.32, 47.47], [-2.20, 47.53],
  // eastern border with Pays de la Loire / Normandie, running north
  [-1.98, 47.60], [-1.72, 47.66], [-1.56, 47.78], [-1.42, 47.88], [-1.36, 48.02],
  [-1.28, 48.16], [-1.18, 48.28], [-1.24, 48.42], [-1.36, 48.52], [-1.46, 48.58],
];

const poly = coast.map(([lon, lat]) => [px(lon), py(lat)]);

function inside(x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// deterministic pseudo-random so rebuilds stay identical
let seed = 20240607;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const STEP = 12, R = 4.1;
const pts = [];
for (let row = 0; row * STEP < H + STEP; row++) {
  const y = row * STEP + STEP / 2;
  const offset = row % 2 ? STEP / 2 : 0; // hex packing reads softer than a square grid
  for (let x = offset + STEP / 2; x < W; x += STEP) {
    if (inside(x, y)) pts.push([x, y]);
  }
}

// Crop the viewBox to the dots so the map fills its container edge to edge.
const PAD = R + 2;
const bx0 = Math.min(...pts.map((p) => p[0])) - PAD;
const by0 = Math.min(...pts.map((p) => p[1])) - PAD;
const bw = Math.max(...pts.map((p) => p[0])) + PAD - bx0;
const bh = Math.max(...pts.map((p) => p[1])) + PAD - by0;

const dots = pts.map(([x, y]) => {
  const o = 0.72 + rnd() * 0.28;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R}" opacity="${o.toFixed(2)}"/>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(bw)}" height="${Math.round(bh)}" viewBox="${bx0.toFixed(1)} ${by0.toFixed(1)} ${bw.toFixed(1)} ${bh.toFixed(1)}" fill="none" role="img" aria-label="Carte de la Bretagne">
<g fill="#7C3AED">
${dots.join('\n')}
</g>
</svg>
`;

const cities = {
  Rennes: [-1.68, 48.11], Brest: [-4.49, 48.39], Lorient: [-3.37, 47.75],
  'Saint-Malo': [-2.02, 48.63], Vannes: [-2.76, 47.66], Quimper: [-4.10, 47.99],
};
const pins = Object.entries(cities).map(([n, [lon, lat]]) =>
  `${n}: left:${(((px(lon) - bx0) / bw) * 100).toFixed(1)}%; top:${(((py(lat) - by0) / bh) * 100).toFixed(1)}%;`);

const { writeFileSync } = await import('node:fs');
writeFileSync(process.argv[2], svg);
console.log(`dots: ${dots.length}`);
console.log(pins.join('\n'));
