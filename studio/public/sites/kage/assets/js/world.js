/* ═══════════════════════════════════════════════════════════════════════
   KAGE · the environmental layer
   A procedural mountain temple at night. Nothing here is loaded from an
   image or a model file: terrain, gate, stairs, hall, lanterns, weather
   and moon are all built from primitives at runtime.
   ═══════════════════════════════════════════════════════════════════════ */

import * as THREE from '../../vendor/three.module.min.js';

/* ── palette (sRGB, converted to linear by three's colour management) ── */
const C = {
  ink:       0x05070b,
  charcoal:  0x121a26,
  stone:     0x515d70,
  stoneWarm: 0x4a453c,
  wood:      0x3b2d24,
  woodLit:   0x543d2f,
  vermilion: 0xbe3f27,
  vermilionLit: 0xd8412f,
  bone:      0xece4d6,
  amber:     0xffb265,
  amberHot:  0xffd9a8,
  moonlight: 0x9dbcff,
  fog:       0x080d16,
};

/* ── deterministic noise helpers ─────────────────────────────────────── */
const fract = (x) => x - Math.floor(x);
function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, octaves = 4) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { sum += vnoise(x * f, y * f) * amp; f *= 2.03; amp *= 0.5; }
  return sum;
}
/* seeded PRNG so every visitor sees the same composition */
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── geometry utilities ──────────────────────────────────────────────── */
function mergeGeoms(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o3 = 0, o2 = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o2);
    o3 += g.attributes.position.count * 3;
    o2 += g.attributes.position.count * 2;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
function placed(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  E.set(rx, ry, rz);
  Q.setFromEuler(E);
  M.compose(V.set(x, y, z), Q, new THREE.Vector3(sx, sy, sz));
  return geo.clone().applyMatrix4(M);
}

/**
 * A concave hip roof with flared eaves — the single most recognisable
 * silhouette in the scene. Height over the footprint follows
 * h * (1 - t^curve) with t the normalised distance to the ridge, so a
 * curve below 1 lifts the corners the way a temple roof does.
 */
function hipRoof(width, depth, height, ridge = 0.34, curve = 0.62, seg = 34) {
  const a = width / 2, b = depth / 2, rx = a * ridge;
  const g = new THREE.PlaneGeometry(width, depth, seg, Math.round(seg * (depth / width)) || seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const tx = Math.max(0, (Math.abs(x) - rx) / Math.max(0.001, a - rx));
    const tz = Math.abs(z) / b;
    const t = Math.min(1, Math.max(tx, tz));
    p.setY(i, height * (1 - Math.pow(t, curve)));
  }
  g.computeVertexNormals();
  return g;
}

/** A beam that curves gently upward at both ends (torii kasagi). */
function curvedBeam(len, h, d, rise) {
  const g = new THREE.BoxGeometry(len, h, d, 26, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) / (len / 2));
    p.setY(i, p.getY(i) + rise * t * t);
  }
  g.computeVertexNormals();
  return g;
}

/* ── runtime textures (no image files) ───────────────────────────────── */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}
const texGlow = () => canvasTex(128, 128, (x, w, h) => {
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,226,180,0.72)');
  g.addColorStop(0.48, 'rgba(255,168,88,0.20)');
  g.addColorStop(1.0, 'rgba(255,150,70,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const texLeaf = () => canvasTex(64, 64, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#ffffff';
  x.beginPath();
  // five-lobed maple silhouette
  const cx = w / 2, cy = h * 0.56, r = w * 0.42;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.62;
    x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(a - 0.16) * r * 0.55, cy + Math.sin(a - 0.16) * r * 0.55);
    x.lineTo(cx + Math.cos(a) * r * (i === 2 ? 1 : 0.86), cy + Math.sin(a) * r * (i === 2 ? 1 : 0.86));
    x.lineTo(cx + Math.cos(a + 0.16) * r * 0.55, cy + Math.sin(a + 0.16) * r * 0.55);
    x.closePath();
  }
  x.fill();
  x.fillRect(cx - w * 0.02, cy, w * 0.04, h * 0.3);
});
const texShoji = () => canvasTex(320, 448, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffd9a4');
  g.addColorStop(0.45, '#f6bd7c');
  g.addColorStop(1, '#c98a4e');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  // paper fibre
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(${Math.random() > 0.5 ? '255,240,214' : '150,96,44'},${Math.random() * 0.10})`;
    x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 9, 1);
  }
  // a shadow of whatever is inside the hall
  const sh = x.createRadialGradient(w * 0.5, h * 0.78, 8, w * 0.5, h * 0.78, w * 0.9);
  sh.addColorStop(0, 'rgba(90,44,16,0.34)');
  sh.addColorStop(1, 'rgba(90,44,16,0)');
  x.fillStyle = sh;
  x.fillRect(0, 0, w, h);
  // kumiko lattice
  x.fillStyle = 'rgba(26,15,8,0.92)';
  const fr = 9;
  x.fillRect(0, 0, w, fr); x.fillRect(0, h - fr, w, fr);
  x.fillRect(0, 0, fr, h); x.fillRect(w - fr, 0, fr, h);
  for (let i = 1; i < 3; i++) x.fillRect(Math.round((i / 3) * w) - 3, 0, 6, h);
  for (let i = 1; i < 7; i++) x.fillRect(0, Math.round((i / 7) * h) - 3, w, 6);
  // the middle rail is heavier
  x.fillRect(0, Math.round(h * 0.5) - 7, w, 14);
});
const texHaze = () => canvasTex(256, 128, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * h, hh = 6 + Math.random() * 26;
    x.globalAlpha = 0.06 + Math.random() * 0.12;
    x.fillRect(0, y, w, hh);
  }
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'destination-out';
  const edge = x.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.42, 'rgba(0,0,0,0)');
  edge.addColorStop(0.58, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = edge; x.fillRect(0, 0, w, h);
  const vedge = x.createLinearGradient(0, 0, 0, h);
  vedge.addColorStop(0, 'rgba(0,0,0,1)');
  vedge.addColorStop(0.4, 'rgba(0,0,0,0)');
  vedge.addColorStop(0.6, 'rgba(0,0,0,0)');
  vedge.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = vedge; x.fillRect(0, 0, w, h);
});

/* ═══════════════════════════════════════════════════════════════════════
   the world
   ═══════════════════════════════════════════════════════════════════════ */
export function createWorld(canvas, options = {}) {
  const reduced = !!options.reducedMotion;

  /* ── renderer ─────────────────────────────────────────────────────── */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, stencil: false,
      depth: true, powerPreference: 'high-performance',
    });
  } catch (err) {
    return null;
  }
  if (!renderer.getContext()) return null;

  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  let quality = isCoarse ? 0.82 : 1;
  const maxDpr = isCoarse ? 1.6 : 1.85;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr) * quality);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(C.ink, 1);

  /* post-processing keeps the scene buffer linear; the composite pass
     tone-maps and encodes to sRGB by hand at the very end. */
  let usePost = true;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.fog, 0.0132);

  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.4, 1400);
  camera.position.set(1.6, 6.2, 62);

  const rnd = mulberry(20260808);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  /* ── sky dome + stars ─────────────────────────────────────────────── */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uMoon: { value: new THREE.Vector3(0.26, 0.30, -0.92) } },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform float uTime; uniform vec3 uMoon;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float up = clamp(d.y*0.5+0.5, 0.0, 1.0);
        vec3 top = vec3(0.006,0.010,0.020);
        vec3 hor = vec3(0.045,0.062,0.098);
        vec3 col = mix(hor, top, pow(up, 0.72));
        // the moon bleeds a cold halo into the sky, warmed by the vermilion disc
        float md = max(0.0, dot(d, normalize(uMoon)));
        col += vec3(0.34,0.17,0.11) * pow(md, 48.0) * 0.42;
        col += vec3(0.09,0.12,0.20) * pow(md, 12.0) * 0.09;
        // stars, thinned near the horizon and near the moon
        vec2 g = floor(d.xy * 260.0 + d.z * 37.0);
        float s = h21(g);
        float star = smoothstep(0.9975, 1.0, s) * smoothstep(0.02, 0.42, d.y);
        float tw = 0.6 + 0.4 * sin(uTime * 1.4 + s * 90.0);
        col += vec3(0.72,0.80,1.0) * star * tw * (1.0 - pow(md, 3.0)) * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  track(sky.geometry); track(skyMat);

  /* ── the moon: a large vermilion disc, low over the ridge ─────────── */
  const moonGroup = new THREE.Group();
  const moonPos = new THREE.Vector3(126, 132, -430);
  moonGroup.position.copy(moonPos);
  const moonMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vUv*2.0-1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float disc = smoothstep(1.0, 0.982, r);
        // limb darkening + a warm centre
        float lim = pow(1.0 - r*r, 0.34);
        vec3 warm = vec3(0.80,0.21,0.11);
        vec3 pale = vec3(0.96,0.56,0.36);
        vec3 col = mix(warm, pale, lim*0.30);
        // maria: soft low-frequency blotches
        float m = vn(p*2.4+3.1)*0.6 + vn(p*5.3)*0.3;
        col *= 0.70 + 0.40*smoothstep(0.28,0.90,m);
        col *= 0.92 * lim;
        gl_FragColor = vec4(col, disc);
      }`,
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1, 72), moonMat);
  moon.scale.setScalar(46);
  moonGroup.add(moon);

  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {},
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      void main(){
        float r = length(vUv*2.0-1.0);
        float a = pow(max(0.0, 1.0-r), 3.6) * 0.15;
        a += pow(max(0.0, 1.0-r), 12.0) * 0.13;
        gl_FragColor = vec4(vec3(0.95,0.48,0.30)*a, a);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat);
  halo.scale.setScalar(215);
  halo.position.z = -2;
  moonGroup.add(halo);
  scene.add(moonGroup);
  track(moon.geometry); track(moonMat); track(halo.geometry); track(haloMat);

  /* ── lighting ─────────────────────────────────────────────────────── */
  const moonDir = new THREE.DirectionalLight(C.moonlight, 2.9);
  moonDir.position.copy(moonPos).normalize().multiplyScalar(100);
  scene.add(moonDir);
  // a dim opposing fill keeps silhouettes from collapsing into the fog
  const fill = new THREE.DirectionalLight(0x35507e, 1.5);
  fill.position.set(-90, 40, 60);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0x1d2a3d, 0x05080d, 0.85));
  scene.add(new THREE.AmbientLight(0x101a2a, 0.75));

  const hallLight = new THREE.PointLight(C.amber, 60, 70, 2);
  hallLight.position.set(0, 25.5, -112);
  scene.add(hallLight);
  const gateLight = new THREE.PointLight(0xffa860, 30, 34, 2);
  gateLight.position.set(0.5, 4.5, 9);
  scene.add(gateLight);
  const stairLight = new THREE.PointLight(C.amber, 26, 34, 2);
  stairLight.position.set(4.2, 10.5, -22);
  scene.add(stairLight);
  const eaveLight = new THREE.PointLight(0xffb478, 52, 52, 2);
  eaveLight.position.set(0, 29.0, -103);
  scene.add(eaveLight);
  const gardenLight = new THREE.PointLight(0xffc08a, 18, 30, 2);
  gardenLight.position.set(-7, 21.5, -86);
  scene.add(gardenLight);

  /* ── terrain ──────────────────────────────────────────────────────── */
  const groundGeo = new THREE.PlaneGeometry(520, 620, 120, 140);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const p = groundGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // the path itself is carved flat and climbs toward the temple
      const pathT = THREE.MathUtils.clamp((6 - z) / 78, 0, 1);
      const terrace = pathT * 19.4;
      const corridor = Math.exp(-Math.pow(x / 26, 2));
      const hills = (fbm(x * 0.012 + 4, z * 0.012 - 2, 5) - 0.5) * 54;
      const rise = THREE.MathUtils.clamp((-z - 40) / 240, 0, 1);
      let y = terrace * corridor + hills * (1 - corridor * 0.94) * (0.30 + rise * 1.35);
      y += (fbm(x * 0.09, z * 0.09, 3) - 0.5) * 1.5 * (1 - corridor * 0.5);
      p.setY(i, y - 0.2);
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: 0x1b232e }));
  scene.add(ground);
  track(groundGeo); track(ground.material);

  /* layered ridge silhouettes for depth */
  const ridgeGroup = new THREE.Group();
  for (let r = 0; r < 4; r++) {
    const g = new THREE.PlaneGeometry(1000, 260, 220, 1);
    const p = g.attributes.position;
    const seedX = r * 31.7;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) {
        const x = p.getX(i);
        const h = (fbm(x * 0.004 + seedX, seedX, 5) - 0.35) * (150 + r * 46);
        p.setY(i, Math.max(6, h + 30 + r * 24));
      } else p.setY(i, -160);
    }
    g.computeVertexNormals();
    const shade = [0x0b111c, 0x0d1420, 0x101825, 0x131c2b][r];
    const m = new THREE.MeshBasicMaterial({ color: shade, fog: true });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(0, 0, -230 - r * 92);
    ridgeGroup.add(mesh);
    track(g); track(m);
  }
  scene.add(ridgeGroup);

  /* ── the approach path, stairs and terrace ────────────────────────── */
  const stoneMat = new THREE.MeshLambertMaterial({ color: C.stone });
  const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x39424f });
  track(stoneMat); track(darkStoneMat);

  const STEPS = 118, STEP_RISE = 0.166, STEP_RUN = 0.63, STEP_Z0 = 2.5;
  const stepGeo = new THREE.BoxGeometry(7.2, STEP_RISE * 1.9, STEP_RUN);
  const stairs = new THREE.InstancedMesh(stepGeo, stoneMat, STEPS);
  for (let i = 0; i < STEPS; i++) {
    const wob = (rnd() - 0.5) * 0.05;
    M.makeTranslation(wob * 2, i * STEP_RISE + 0.1, STEP_Z0 - i * STEP_RUN);
    stairs.setMatrixAt(i, M);
  }
  stairs.instanceMatrix.needsUpdate = true;
  scene.add(stairs);
  track(stepGeo);

  /* retaining walls either side of the stair */
  const wallGeo = mergeGeoms([
    placed(new THREE.BoxGeometry(1.5, 3.2, 78), -4.6, 0, 0),
    placed(new THREE.BoxGeometry(1.5, 3.2, 78), 4.6, 0, 0),
  ]);
  {
    const p = wallGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      p.setY(i, p.getY(i) + THREE.MathUtils.clamp((STEP_Z0 - z) / STEP_RUN, 0, STEPS) * STEP_RISE);
    }
    wallGeo.computeVertexNormals();
  }
  const walls = new THREE.Mesh(wallGeo, darkStoneMat);
  walls.position.z = -36;
  scene.add(walls);
  track(wallGeo);

  /* terrace slab under the garden and the hall */
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(74, 2.2, 66), darkStoneMat);
  terrace.position.set(0, 18.6, -104);
  scene.add(terrace);
  track(terrace.geometry);

  /* ── torii gates ──────────────────────────────────────────────────── */
  function toriiGeometry(s = 1) {
    const col = new THREE.CylinderGeometry(0.30 * s, 0.40 * s, 8.2 * s, 14, 1);
    return mergeGeoms([
      placed(col, -3.35 * s, 4.1 * s, 0, 0, 0, 0.035),
      placed(col, 3.35 * s, 4.1 * s, 0, 0, 0, -0.035),
      placed(curvedBeam(9.6 * s, 0.46 * s, 1.0 * s, 0.75 * s), 0, 8.35 * s, 0),
      placed(curvedBeam(8.6 * s, 0.30 * s, 0.72 * s, 0.52 * s), 0, 7.86 * s, 0),
      placed(new THREE.BoxGeometry(7.7 * s, 0.42 * s, 0.5 * s), 0, 6.35 * s, 0),
      placed(new THREE.BoxGeometry(0.42 * s, 1.3 * s, 0.36 * s), 0, 7.1 * s, 0),
    ]);
  }
  const toriiMat = new THREE.MeshLambertMaterial({ color: C.vermilion, emissive: 0x2a0b05 });
  track(toriiMat);
  const toriiPlacements = [
    { z: 6.0, s: 1.15, y: 0 },
    { z: -14.0, s: 0.92, y: (STEP_Z0 + 14) / STEP_RUN * STEP_RISE },
    { z: -38.0, s: 0.86, y: (STEP_Z0 + 38) / STEP_RUN * STEP_RISE },
    { z: -62.0, s: 0.80, y: (STEP_Z0 + 62) / STEP_RUN * STEP_RISE },
  ];
  for (const t of toriiPlacements) {
    const g = toriiGeometry(t.s);
    const m = new THREE.Mesh(g, toriiMat);
    m.position.set(0, Math.min(t.y, 19.0), t.z);
    scene.add(m);
    track(g);
  }

  /* ── stone lanterns ───────────────────────────────────────────────── */
  const lanternStone = mergeGeoms([
    placed(new THREE.CylinderGeometry(0.62, 0.78, 0.42, 10), 0, 0.21, 0),
    placed(new THREE.CylinderGeometry(0.24, 0.30, 1.55, 8), 0, 1.16, 0),
    placed(new THREE.CylinderGeometry(0.66, 0.50, 0.26, 10), 0, 2.06, 0),
    placed(new THREE.BoxGeometry(0.94, 0.86, 0.94), 0, 2.62, 0),
    placed(new THREE.ConeGeometry(0.98, 0.62, 4), 0, 3.34, 0, 0, Math.PI / 4, 0),
    placed(new THREE.SphereGeometry(0.16, 8, 6), 0, 3.74, 0),
  ]);
  const lanternMat = new THREE.MeshLambertMaterial({ color: 0x4a5464 });
  const fireGeo = new THREE.BoxGeometry(0.74, 0.62, 0.74);
  const fireMat = new THREE.MeshBasicMaterial({ color: C.amberHot, fog: true });
  track(lanternStone); track(lanternMat); track(fireGeo); track(fireMat);

  const lanternSpots = [];
  for (let i = 0; i < 22; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const step = 6 + i * 5.2;
    const z = STEP_Z0 - step * STEP_RUN;
    const y = Math.min(step * STEP_RISE, 19.4);
    lanternSpots.push({ x: side * (5.9 + (rnd() - 0.5) * 0.4), y, z, s: 0.95 + rnd() * 0.25 });
  }
  lanternSpots.push({ x: -13.5, y: 19.7, z: -84, s: 1.3 });
  lanternSpots.push({ x: 14.5, y: 19.7, z: -96, s: 1.2 });
  lanternSpots.push({ x: -10.5, y: 19.7, z: -120, s: 1.15 });

  const lanterns = new THREE.InstancedMesh(lanternStone, lanternMat, lanternSpots.length);
  const fires = new THREE.InstancedMesh(fireGeo, fireMat, lanternSpots.length);
  lanternSpots.forEach((l, i) => {
    M.compose(V.set(l.x, l.y, l.z), Q.setFromEuler(E.set(0, rnd() * 6.28, 0)), new THREE.Vector3(l.s, l.s, l.s));
    lanterns.setMatrixAt(i, M);
    M.compose(V.set(l.x, l.y + 2.62 * l.s, l.z), Q, new THREE.Vector3(l.s, l.s, l.s));
    fires.setMatrixAt(i, M);
  });
  lanterns.instanceMatrix.needsUpdate = true;
  fires.instanceMatrix.needsUpdate = true;
  scene.add(lanterns, fires);

  /* additive glow sprites around each flame */
  const glowTex = track(texGlow());
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: true, opacity: 0.42,
  });
  const glowGeo = new THREE.PlaneGeometry(1, 1);
  const glows = new THREE.InstancedMesh(glowGeo, glowMat, lanternSpots.length);
  glows.frustumCulled = false;
  scene.add(glows);
  track(glowGeo); track(glowMat);

  /* ── the hall ─────────────────────────────────────────────────────── */
  const hall = new THREE.Group();
  hall.position.set(0, 19.7, -116);

  const woodMat = new THREE.MeshLambertMaterial({ color: C.wood, emissive: 0x0d0805 });
  const beamMat = new THREE.MeshLambertMaterial({ color: 0x4d3a2c, emissive: 0x0e0805 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4c5866, emissive: 0x121821, side: THREE.DoubleSide });
  const shojiTex = track(texShoji());
  const shojiMat = new THREE.MeshBasicMaterial({ map: shojiTex, color: 0xb98a5d, fog: true });
  track(woodMat); track(beamMat); track(roofMat); track(shojiMat);

  const HW = 30, HD = 19;

  const podium = new THREE.Mesh(new THREE.BoxGeometry(HW + 5, 1.7, HD + 5), darkStoneMat);
  podium.position.y = 0.85;
  hall.add(podium); track(podium.geometry);

  const body = new THREE.Mesh(new THREE.BoxGeometry(HW - 2.4, 7.4, HD - 2.4), woodMat);
  body.position.y = 5.4;
  hall.add(body); track(body.geometry);

  /* shoji screens across the front, each a slightly different warmth */
  const shojiGeo = new THREE.PlaneGeometry(3.0, 5.1);
  for (let i = 0; i < 8; i++) {
    const m = shojiMat.clone();
    m.color = new THREE.Color(0x9d7148).lerp(new THREE.Color(0xd0a271), 0.08 + (i % 3) * 0.16);
    const s = new THREE.Mesh(shojiGeo, m);
    s.position.set(-11.2 + i * 3.2, 5.0, (HD - 2.4) / 2 + 0.04);
    hall.add(s);
    track(m);
  }
  track(shojiGeo);
  /* a soft warm wash bleeding out of the façade, for the bloom to catch */
  const washMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.13, fog: true,
  });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), washMat);
  wash.position.set(0, 6, (HD - 2.4) / 2 + 1.6);
  hall.add(wash);
  track(wash.geometry); track(washMat);

  /* pillars */
  const pillarGeo = new THREE.CylinderGeometry(0.42, 0.46, 8.4, 10);
  const pillars = new THREE.InstancedMesh(pillarGeo, beamMat, 12);
  let pi = 0;
  for (let i = 0; i < 6; i++) {
    for (const sz of [-1, 1]) {
      M.makeTranslation(-13.4 + i * 5.36, 5.9, sz * (HD / 2 - 0.4));
      pillars.setMatrixAt(pi++, M);
    }
  }
  pillars.instanceMatrix.needsUpdate = true;
  hall.add(pillars); track(pillarGeo);

  /* two roof tiers */
  const roofLower = new THREE.Mesh(hipRoof(HW + 11, HD + 11, 5.4, 0.30, 0.60, 40), roofMat);
  roofLower.position.y = 9.6;
  hall.add(roofLower); track(roofLower.geometry);
  const roofUpper = new THREE.Mesh(hipRoof(HW - 5, HD - 5, 6.6, 0.34, 0.58, 36), roofMat);
  roofUpper.position.y = 13.4;
  hall.add(roofUpper); track(roofUpper.geometry);
  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry((HW - 5) * 0.36, 0.7, 1.3), beamMat);
  ridgeBeam.position.y = 20.1;
  hall.add(ridgeBeam); track(ridgeBeam.geometry);

  /* approach steps up to the hall */
  const hallStepGeo = new THREE.BoxGeometry(13, 0.34, 0.9);
  const hallSteps = new THREE.InstancedMesh(hallStepGeo, stoneMat, 5);
  for (let i = 0; i < 5; i++) {
    M.makeTranslation(0, 0.28 + i * 0.34, HD / 2 + 3.4 - i * 0.9);
    hallSteps.setMatrixAt(i, M);
  }
  hallSteps.instanceMatrix.needsUpdate = true;
  hall.add(hallSteps); track(hallStepGeo);
  scene.add(hall);

  /* ── the still garden ─────────────────────────────────────────────── */
  const gravelMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTint: { value: new THREE.Color(0x2b3342) } },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        #include <fog_vertex>
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec2 vUv; uniform vec3 uTint;
      void main(){
        vec2 p = (vUv - vec2(0.42, 0.55)) * vec2(2.6, 1.8);
        float d = length(p);
        // rake lines: concentric rings around the principal stone
        float rings = sin(d * 118.0);
        float lines = smoothstep(0.35, 1.0, rings) * 0.5 + 0.5;
        float straight = smoothstep(0.4, 1.0, sin(vUv.y * 210.0)) * 0.5 + 0.5;
        float m = mix(straight, lines, smoothstep(0.9, 0.25, d));
        vec3 col = uTint * (0.56 + 0.46 * m);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(44, 30, 1, 1), gravelMat);
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set(-8, 19.76, -86);
  scene.add(gravel);
  track(gravel.geometry); track(gravelMat);

  /* fifteen stones, only ever fourteen of them visible at once */
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = 0.72 + fbm(p.getX(i) * 2.2 + 9, p.getZ(i) * 2.2, 3) * 0.7;
      p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * 0.72, p.getZ(i) * n);
    }
    rockGeo.computeVertexNormals();
  }
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4b5464 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 15);
  for (let i = 0; i < 15; i++) {
    const s = 0.5 + rnd() * 1.5;
    M.compose(
      V.set(-8 + (rnd() - 0.5) * 34, 19.7 + s * 0.3, -86 + (rnd() - 0.5) * 22),
      Q.setFromEuler(E.set(rnd() * 0.3, rnd() * 6.28, rnd() * 0.3)),
      new THREE.Vector3(s, s * (0.6 + rnd() * 0.5), s)
    );
    rocks.setMatrixAt(i, M);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);
  track(rockGeo); track(rockMat);

  /* the water basin, holding the moon */
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog, { uTime: { value: 0 } },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
        #include <fog_vertex>
        gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 p = vUv*2.0-1.0;
        float ripple = sin(length(p)*26.0 - uTime*1.6) * 0.5 + 0.5;
        float moonStreak = smoothstep(0.42, 0.0, abs(p.x + sin(p.y*3.0+uTime*0.4)*0.06));
        moonStreak *= smoothstep(1.0, -0.2, p.y);
        vec3 col = vec3(0.03,0.05,0.08) + vec3(0.95,0.46,0.30) * moonStreak * (0.25 + 0.20*ripple);
        col += vec3(0.10,0.14,0.22) * ripple * 0.14;
        gl_FragColor = vec4(col, 0.94);
        #include <fog_fragment>
      }`,
  });
  const basin = new THREE.Group();
  const basinStone = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 1.5, 14), new THREE.MeshLambertMaterial({ color: 0x4d5661 }));
  basinStone.position.y = 0.75;
  const basinWater = new THREE.Mesh(new THREE.CircleGeometry(1.45, 28), waterMat);
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.y = 1.44;
  basin.add(basinStone, basinWater);
  basin.position.set(11.5, 19.7, -80);
  scene.add(basin);
  track(basinStone.geometry); track(basinStone.material); track(basinWater.geometry); track(waterMat);

  /* garden wall along the terrace edge */
  const gWallGeo = mergeGeoms([
    placed(new THREE.BoxGeometry(70, 4.2, 1.1), 0, 2.1, 0),
    placed(hipRoof(70, 2.6, 0.7, 0.9, 0.8, 24), 0, 4.2, 0),
  ]);
  const gWall = new THREE.Mesh(gWallGeo, new THREE.MeshLambertMaterial({ color: 0x4e4f50 }));
  gWall.position.set(0, 19.7, -72);
  scene.add(gWall);
  track(gWallGeo); track(gWall.material);

  /* ── trees ────────────────────────────────────────────────────────── */
  const pineGeo = mergeGeoms([
    placed(new THREE.CylinderGeometry(0.16, 0.30, 5.2, 6), 0, 2.6, 0),
    placed(new THREE.ConeGeometry(2.4, 3.4, 7), 0, 5.0, 0),
    placed(new THREE.ConeGeometry(1.95, 3.1, 7), 0, 6.9, 0),
    placed(new THREE.ConeGeometry(1.45, 2.7, 7), 0, 8.6, 0),
    placed(new THREE.ConeGeometry(0.95, 2.2, 7), 0, 10.1, 0),
  ]);
  const pineMat = new THREE.MeshLambertMaterial({ color: 0x16241f });
  const PINES = 132;
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, PINES);
  for (let i = 0; i < PINES; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const z = 40 - rnd() * 230;
    const dist = 11 + Math.pow(rnd(), 0.6) * 62;
    const x = side * dist;
    const pathT = THREE.MathUtils.clamp((6 - z) / 78, 0, 1);
    const corridor = Math.exp(-Math.pow(x / 26, 2));
    const base = pathT * 19.4 * corridor
      + (fbm(x * 0.012 + 4, z * 0.012 - 2, 5) - 0.5) * 54 * (1 - corridor * 0.94) * 0.9;
    const s = 0.75 + rnd() * 1.5;
    M.compose(V.set(x, base - 1.5, z), Q.setFromEuler(E.set(0, rnd() * 6.28, (rnd() - 0.5) * 0.06)),
      new THREE.Vector3(s, s * (0.85 + rnd() * 0.7), s));
    pines.setMatrixAt(i, M);
  }
  pines.instanceMatrix.needsUpdate = true;
  scene.add(pines);
  track(pineGeo); track(pineMat);

  /* maple masses — dark blooms with a bruise of vermilion */
  const mapleGeo = new THREE.IcosahedronGeometry(1, 1);
  const mapleMat = new THREE.MeshLambertMaterial({ color: 0x351820 });
  const MAPLES = 46;
  const maples = new THREE.InstancedMesh(mapleGeo, mapleMat, MAPLES);
  for (let i = 0; i < MAPLES; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const z = 20 - rnd() * 150;
    const x = side * (9 + rnd() * 26);
    const pathT = THREE.MathUtils.clamp((6 - z) / 78, 0, 1);
    const corridor = Math.exp(-Math.pow(x / 26, 2));
    const base = pathT * 19.4 * corridor
      + (fbm(x * 0.012 + 4, z * 0.012 - 2, 5) - 0.5) * 54 * (1 - corridor * 0.94) * 0.9;
    const s = 2.2 + rnd() * 3.4;
    M.compose(V.set(x, base + s * 0.8, z), Q.setFromEuler(E.set(rnd(), rnd() * 6.28, rnd())),
      new THREE.Vector3(s, s * 0.72, s));
    maples.setMatrixAt(i, M);
  }
  maples.instanceMatrix.needsUpdate = true;
  scene.add(maples);
  track(mapleGeo); track(mapleMat);

  /* ── weather: rain, leaves, embers, haze ──────────────────────────── */
  const RAIN = isCoarse ? 900 : 1700;
  const rainGeo = new THREE.InstancedBufferGeometry();
  rainGeo.index = null;
  {
    const base = new THREE.PlaneGeometry(1, 1);
    rainGeo.setAttribute('position', base.attributes.position);
    rainGeo.setAttribute('uv', base.attributes.uv);
    rainGeo.setIndex(base.index);
    const seeds = new Float32Array(RAIN * 4);
    for (let i = 0; i < RAIN; i++) {
      seeds[i * 4 + 0] = rnd();
      seeds[i * 4 + 1] = rnd();
      seeds[i * 4 + 2] = rnd();
      seeds[i * 4 + 3] = 0.6 + rnd() * 0.8;
    }
    rainGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    rainGeo.instanceCount = RAIN;
    base.dispose();
  }
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmt: { value: 1 } },
    vertexShader: `
      attribute vec4 aSeed;
      uniform float uTime; uniform vec3 uCam;
      varying float vFade;
      void main(){
        float box = 78.0, high = 46.0;
        // a falling column of rain that always surrounds the camera
        vec3 cell = floor(uCam / box) * box;
        float fall = mod(aSeed.y * high - uTime * (13.0 + aSeed.w * 16.0), high);
        vec3 wp = cell + vec3(
          aSeed.x * box - box * 0.5 + uCam.x - cell.x + mod(uCam.x, 1.0),
          fall,
          aSeed.z * box - box * 0.5
        );
        wp.x = uCam.x + (aSeed.x - 0.5) * box;
        wp.z = uCam.z + (aSeed.z - 0.5) * box;
        wp.y = uCam.y + 16.0 - fall;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        float len = 0.24 + aSeed.w * 0.42;
        // slight lean gives the wind a direction
        vec2 q = vec2(position.x * 0.016 + position.y * 0.16, position.y * len);
        mv.xy += q;
        vFade = smoothstep(74.0, 14.0, -mv.z) * smoothstep(1.5, 7.0, -mv.z) * (0.35 + aSeed.w * 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vFade; uniform float uAmt;
      void main(){
        gl_FragColor = vec4(vec3(0.62, 0.72, 0.92), vFade * 0.16 * uAmt);
      }`,
  });
  const rain = new THREE.Mesh(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);
  track(rainGeo); track(rainMat);

  /* drifting leaves */
  const LEAVES = isCoarse ? 40 : 90;
  const leafTex = track(texLeaf());
  const leafGeo = new THREE.InstancedBufferGeometry();
  {
    const base = new THREE.PlaneGeometry(1, 1);
    leafGeo.setAttribute('position', base.attributes.position);
    leafGeo.setAttribute('uv', base.attributes.uv);
    leafGeo.setIndex(base.index);
    const seeds = new Float32Array(LEAVES * 4);
    for (let i = 0; i < LEAVES; i++) {
      seeds[i * 4 + 0] = rnd(); seeds[i * 4 + 1] = rnd();
      seeds[i * 4 + 2] = rnd(); seeds[i * 4 + 3] = rnd();
    }
    leafGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    leafGeo.instanceCount = LEAVES;
    base.dispose();
  }
  const leafMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uMap: { value: leafTex } },
    vertexShader: `
      attribute vec4 aSeed;
      uniform float uTime; uniform vec3 uCam;
      varying vec2 vUv; varying float vFade; varying float vTone;
      void main(){
        vUv = uv; vTone = aSeed.w;
        float box = 46.0, high = 26.0;
        float t = uTime * (0.25 + aSeed.w * 0.3);
        float fall = mod(aSeed.y * high - t * 2.2, high);
        vec3 wp;
        wp.x = uCam.x + (aSeed.x - 0.5) * box + sin(t * 1.6 + aSeed.z * 9.0) * 2.4;
        wp.z = uCam.z + (aSeed.z - 0.5) * box + cos(t * 1.1 + aSeed.x * 7.0) * 2.0;
        wp.y = uCam.y + 9.0 - fall;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        float a = t * 2.4 + aSeed.x * 6.28;
        float s = 0.16 + aSeed.w * 0.13;
        vec2 q = position.xy * s;
        q = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
        mv.xy += q;
        vFade = smoothstep(44.0, 6.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv; varying float vFade; varying float vTone;
      void main(){
        float a = texture2D(uMap, vUv).a;
        if (a < 0.08) discard;
        vec3 col = mix(vec3(0.42,0.10,0.06), vec3(0.72,0.28,0.12), vTone);
        gl_FragColor = vec4(col, a * vFade * 0.85);
      }`,
  });
  const leaves = new THREE.Mesh(leafGeo, leafMat);
  leaves.frustumCulled = false;
  scene.add(leaves);
  track(leafGeo); track(leafMat);

  /* embers lifting off the lantern flames */
  const EMBERS = isCoarse ? 130 : 260;
  const emberGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(EMBERS * 3), seed = new Float32Array(EMBERS * 2);
    for (let i = 0; i < EMBERS; i++) {
      const l = lanternSpots[Math.floor(rnd() * lanternSpots.length)];
      pos[i * 3] = l.x + (rnd() - 0.5) * 2.2;
      pos[i * 3 + 1] = l.y + 2.6;
      pos[i * 3 + 2] = l.z + (rnd() - 0.5) * 2.2;
      seed[i * 2] = rnd(); seed[i * 2 + 1] = 0.4 + rnd() * 0.8;
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  }
  const emberMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSize: { value: 1 } },
    vertexShader: `
      attribute vec2 aSeed;
      uniform float uTime; uniform float uSize;
      varying float vA;
      void main(){
        vec3 p = position;
        float t = mod(uTime * aSeed.y * 0.42 + aSeed.x, 1.0);
        p.y += t * 7.0;
        p.x += sin(uTime * 0.9 + aSeed.x * 22.0) * 0.85 * t;
        p.z += cos(uTime * 0.7 + aSeed.x * 15.0) * 0.7 * t;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (1.0 - t) * (0.55 + 0.45 * sin(uTime * 8.0 + aSeed.x * 30.0));
        gl_PointSize = uSize * (14.0 + aSeed.y * 12.0) / max(1.0, -mv.z) * 8.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = 1.0 - clamp(length(p), 0.0, 1.0);
        gl_FragColor = vec4(vec3(1.0, 0.62, 0.28) * d * d, d * d * vA * 0.9);
      }`,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  scene.add(embers);
  track(emberGeo); track(emberMat);

  /* depth haze bands drifting between the ridges */
  const hazeTex = track(texHaze());
  const hazeMat = new THREE.MeshBasicMaterial({
    map: hazeTex, transparent: true, depthWrite: false, fog: false,
    color: 0x223046, opacity: 0.10,
  });
  track(hazeMat);
  const hazes = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(360, 60), hazeMat);
    m.position.set((rnd() - 0.5) * 90, 3 + i * 4.2 + rnd() * 4, -60 - i * 58);
    m.userData.drift = 0.6 + rnd() * 1.4;
    hazes.push(m);
    scene.add(m);
    track(m.geometry);
  }

  /* ═════ post-processing: bloom → grain → vignette → tone map ═══════ */
  const fsQuadGeo = new THREE.PlaneGeometry(2, 2);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsScene = new THREE.Scene();
  const fsMesh = new THREE.Mesh(fsQuadGeo, null);
  fsMesh.frustumCulled = false;
  fsScene.add(fsMesh);
  track(fsQuadGeo);

  const rtOpts = {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    colorSpace: THREE.LinearSRGBColorSpace,
  };
  let rtScene, rtA, rtB;
  try {
    rtScene = new THREE.WebGLRenderTarget(2, 2, rtOpts);
    rtA = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
    rtB = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
  } catch (err) {
    usePost = false;
  }

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uThresh: { value: 0.62 }, uKnee: { value: 0.42 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D tMap; uniform float uThresh; uniform float uKnee;
      void main(){
        vec3 c = texture2D(tMap, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float w = smoothstep(uThresh, uThresh + uKnee, l);
        gl_FragColor = vec4(c * w, 1.0);
      }`,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uDir; uniform vec2 uTexel;
      void main(){
        vec2 o = uDir * uTexel;
        vec3 s = texture2D(tMap, vUv).rgb * 0.2270270270;
        s += texture2D(tMap, vUv + o * 1.3846153846).rgb * 0.3162162162;
        s += texture2D(tMap, vUv - o * 1.3846153846).rgb * 0.3162162162;
        s += texture2D(tMap, vUv + o * 3.2307692308).rgb * 0.0702702703;
        s += texture2D(tMap, vUv - o * 3.2307692308).rgb * 0.0702702703;
        gl_FragColor = vec4(s, 1.0);
      }`,
  });
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tBloom: { value: null },
      uTime: { value: 0 }, uBloom: { value: 0.50 }, uGrain: { value: 0.024 },
      uVignette: { value: 1.18 }, uRes: { value: new THREE.Vector2(1, 1) },
      uExposure: { value: 0.96 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tScene; uniform sampler2D tBloom;
      uniform float uTime, uBloom, uGrain, uVignette, uExposure;
      uniform vec2 uRes;

      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      // ACES filmic, fitted — keeps the amber highlights from going pink
      vec3 aces(vec3 x){
        const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }

      void main(){
        vec3 base  = texture2D(tScene, vUv).rgb;
        vec3 bloom = texture2D(tBloom, vUv).rgb;
        vec3 col = base + bloom * uBloom;

        col *= uExposure;
        col = aces(col);

        // split tone: cold shadows, warm highlights
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col * vec3(0.88, 0.95, 1.14), col * vec3(1.06, 0.99, 0.90), smoothstep(0.16, 0.78, l));

        // vignette
        vec2 q = vUv - 0.5;
        q.x *= uRes.x / max(1.0, uRes.y);
        float v = 1.0 - dot(q, q) * uVignette;
        col *= clamp(v, 0.0, 1.0);

        // film grain, a touch stronger in the shadows
        float g = h21(vUv * uRes + fract(uTime) * 91.7) - 0.5;
        col += g * uGrain * (1.15 - l * 0.6);

        // linear → sRGB (the renderer is left in linear output for this pass)
        col = max(col, vec3(0.0));
        vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
        gl_FragColor = vec4(srgb, 1.0);
      }`,
  });
  track(brightMat); track(blurMat); track(compositeMat);

  if (!usePost) renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ── camera choreography ──────────────────────────────────────────── */
  const SHOTS = [
    { p: [3.0, 5.2, 28], t: [-1.0, 12.0, -34], fov: 48 },   // 0 · hero, the first gate
    { p: [0.2, 4.4, 16], t: [-0.5, 8.8, -20], fov: 38 },    // 1 · under the gate
    { p: [-4.2, 9.0, -10], t: [1.6, 16.0, -58], fov: 44 },  // 2 · the stair
    { p: [13.0, 30.5, -58], t: [-5.0, 19.2, -88], fov: 38 },// 3 · down over the raked field
    { p: [-8.5, 24.5, -66], t: [0.5, 29.5, -112], fov: 42 },// 4 · the hall, whole
    { p: [10.0, 46.0, -57], t: [-2.0, 24.0, -124], fov: 38 },// 5 · afterlight, from above
    { p: [0.0, 52.0, -40], t: [0.0, 26.0, -152], fov: 56 }, // 6 · manifesto, pulling out
  ];
  const shotPos = SHOTS.map((s) => new THREE.Vector3(...s.p));
  const shotTgt = SHOTS.map((s) => new THREE.Vector3(...s.t));

  const camPos = shotPos[0].clone();
  const camTgt = shotTgt[0].clone();
  const wantPos = camPos.clone();
  const wantTgt = camTgt.clone();
  let wantFov = SHOTS[0].fov;

  let progress = 0;      // 0..1 across the whole page
  let shotIndex = 0;
  const pointer = new THREE.Vector2(0, 0);
  const pointerSmooth = new THREE.Vector2(0, 0);

  const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);

  function composeShot(t) {
    // Each section holds its composed frame for the first part of its scroll,
    // then eases to the next one — a cut-free sequence of held shots.
    const span = SHOTS.length - 1;
    const f = THREE.MathUtils.clamp(t, 0, 1) * span;
    const i = Math.min(span - 1, Math.floor(f));
    const u = f - i;
    const travel = smoother(THREE.MathUtils.clamp((u - 0.30) / 0.62, 0, 1));

    wantPos.copy(shotPos[i]).lerp(shotPos[i + 1], travel);
    wantTgt.copy(shotTgt[i]).lerp(shotTgt[i + 1], travel);
    wantFov = THREE.MathUtils.lerp(SHOTS[i].fov, SHOTS[i + 1].fov, travel);

    // a slow push during the hold so no frame is ever completely still
    const hold = THREE.MathUtils.clamp(u / 0.30, 0, 1);
    const dolly = V.copy(shotTgt[i]).sub(shotPos[i]).normalize().multiplyScalar(hold * 1.5 * (1 - travel));
    wantPos.add(dolly);
    shotIndex = travel > 0.5 ? i + 1 : i;
  }

  /* ── frame loop ───────────────────────────────────────────────────── */
  let last = performance.now();
  let time = 0;
  let width = 1, height = 1;
  let running = true;
  let frames = 0, slowFrames = 0;
  const tmpV = new THREE.Vector3();

  function setSize() {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr) * quality);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const dpr = renderer.getPixelRatio();
    const w = Math.max(2, Math.floor(width * dpr));
    const h = Math.max(2, Math.floor(height * dpr));
    if (usePost) {
      rtScene.setSize(w, h);
      const bw = Math.max(2, Math.floor(w / 2)), bh = Math.max(2, Math.floor(h / 2));
      rtA.setSize(bw, bh);
      rtB.setSize(bw, bh);
      blurMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
      compositeMat.uniforms.uRes.value.set(w, h);
    }
  }

  function pass(material, target) {
    fsMesh.material = material;
    renderer.setRenderTarget(target || null);
    renderer.render(fsScene, fsCam);
  }

  function frame() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += reduced ? 0 : dt;

    composeShot(progress);

    // eased interpolation toward the composed frame + restrained parallax
    const k = reduced ? 1 : 1 - Math.pow(0.0016, dt);
    camPos.lerp(wantPos, k);
    camTgt.lerp(wantTgt, k);
    pointerSmooth.lerp(pointer, reduced ? 1 : 1 - Math.pow(0.002, dt));

    const drift = reduced ? 0 : 1;
    camera.position.copy(camPos);
    camera.position.x += pointerSmooth.x * 1.5 + Math.sin(time * 0.21) * 0.32 * drift;
    camera.position.y += pointerSmooth.y * 0.9 + Math.cos(time * 0.17) * 0.22 * drift;
    camera.fov += (wantFov - camera.fov) * k;
    camera.updateProjectionMatrix();
    camera.lookAt(camTgt);

    sky.position.copy(camera.position);
    skyMat.uniforms.uTime.value = time;
    moonMat.uniforms.uTime.value = time;
    moonGroup.lookAt(camera.position);

    rainMat.uniforms.uTime.value = time;
    rainMat.uniforms.uCam.value.copy(camera.position);
    leafMat.uniforms.uTime.value = time;
    leafMat.uniforms.uCam.value.copy(camera.position);
    emberMat.uniforms.uTime.value = time;
    waterMat.uniforms.uTime.value = time;

    // lantern flames breathe, and their glow sprites face the camera
    for (let i = 0; i < lanternSpots.length; i++) {
      const l = lanternSpots[i];
      const flick = 0.86 + Math.sin(time * (2.1 + i) + i * 1.7) * 0.09 + Math.sin(time * 7.3 + i) * 0.05;
      const s = (1.9 + flick * 0.9) * l.s;
      tmpV.set(l.x, l.y + 2.62 * l.s, l.z);
      M.compose(tmpV, camera.quaternion, V.set(s, s, s));
      glows.setMatrixAt(i, M);
    }
    glows.instanceMatrix.needsUpdate = true;
    hallLight.intensity = 60 + Math.sin(time * 1.6) * 6;

    for (const h of hazes) {
      h.position.x += h.userData.drift * dt * 0.5;
      if (h.position.x > 140) h.position.x = -140;
      h.lookAt(camera.position.x, h.position.y, camera.position.z);
    }

    if (usePost) {
      renderer.setRenderTarget(rtScene);
      renderer.clear();
      renderer.render(scene, camera);

      brightMat.uniforms.tMap.value = rtScene.texture;
      pass(brightMat, rtA);
      blurMat.uniforms.tMap.value = rtA.texture;
      blurMat.uniforms.uDir.value.set(1, 0);
      pass(blurMat, rtB);
      blurMat.uniforms.tMap.value = rtB.texture;
      blurMat.uniforms.uDir.value.set(0, 1);
      pass(blurMat, rtA);

      compositeMat.uniforms.tScene.value = rtScene.texture;
      compositeMat.uniforms.tBloom.value = rtA.texture;
      compositeMat.uniforms.uTime.value = time;
      renderer.setRenderTarget(null);
      pass(compositeMat, null);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }

    // if the device cannot keep up, shed pixels once rather than stutter on
    frames++;
    if (frames > 90 && quality > 0.66) {
      if (dt > 0.038) slowFrames++;
      if (frames % 90 === 0) {
        if (slowFrames > 45) { quality = 0.7; setSize(); }
        slowFrames = 0;
      }
    }
  }

  setSize();

  return {
    get camera() { return camera; },
    get renderer() { return renderer; },
    get shot() { return shotIndex; },
    setProgress(p) { progress = THREE.MathUtils.clamp(p, 0, 1); },
    /** jump straight to a composed shot (used for reduced motion + anchors) */
    snapTo(index) {
      const i = THREE.MathUtils.clamp(index, 0, SHOTS.length - 1);
      progress = i / (SHOTS.length - 1);
      composeShot(progress);
      camPos.copy(wantPos); camTgt.copy(wantTgt);
      camera.fov = wantFov;
    },
    setPointer(x, y) { pointer.set(x, y); },
    resize: setSize,
    frame,
    stop() { running = false; },
    start() { running = true; last = performance.now(); },
    dispose() {
      running = false;
      for (const d of disposables) d?.dispose?.();
      rtScene?.dispose(); rtA?.dispose(); rtB?.dispose();
      renderer.dispose();
    },
    shots: SHOTS.length,
  };
}
